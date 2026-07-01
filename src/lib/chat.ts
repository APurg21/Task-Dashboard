import Anthropic from "@anthropic-ai/sdk";
import { searchChunks, type Retrieved } from "./knowledge";
import { MissingApiKeyError } from "./classify";
import { kv } from "./redis";

// The user's editable Chief-of-Staff voice, set in the command center's Edit
// form and stored on the profile. Loaded here so EVERY chat surface (Chief of
// Staff, the task-board chat, Telegram ask:) speaks in their preferred voice.
export async function getChiefStyle(): Promise<string | undefined> {
  try {
    const p = await kv.get<{ chiefStyle?: string }>("cc:profile");
    const s = p?.chiefStyle?.trim();
    return s || undefined;
  } catch {
    return undefined;
  }
}

// AI Chat over your knowledge base. Retrieve the most relevant chunks, hand them
// to Sonnet 5 as numbered sources, and require inline [n] citations. Answers are
// grounded in your notes when possible; general knowledge is used only when the
// notes don't cover it, and the model is told to say so.

export interface ChatSource {
  n: number;
  title: string;
  sourceType: string | null;
  sourceName: string | null;
  url: string | null;
  snippet: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  answer: string;
  sources: ChatSource[];
  usedKnowledge: boolean;
}

function contextBlock(chunks: Retrieved[]): string {
  return chunks
    .map((c, i) => {
      const label = c.sourceName || c.title || c.sourceType || "note";
      return `[${i + 1}] (${label})\n${c.text}`;
    })
    .join("\n\n---\n\n");
}

const SYSTEM = `You are the user's personal work assistant with access to their knowledge base (notes, plans, imported docs). Answer their question using the numbered SOURCES below.

Rules:
- Ground your answer in the sources. Cite them inline with [n] matching the source number, right after the claim they support.
- If the sources don't fully answer the question, use your general knowledge to fill the gap but say so plainly (e.g. "Your notes don't cover X, but generally…"). Never fabricate a citation.
- If the sources are empty or irrelevant, answer from general knowledge and open with a short note that nothing in their knowledge base was relevant.
- Be concise and direct. Prefer specifics from the sources over generic advice.`;

export async function answerQuestion(
  question: string,
  history: ChatTurn[] = [],
  style?: string
): Promise<ChatResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError("ANTHROPIC_API_KEY is not set.");

  const voice = style ?? (await getChiefStyle());
  const system = voice
    ? `${SYSTEM}\n\nVOICE — this is how the user wants you to talk to them; follow it closely:\n${voice}`
    : SYSTEM;

  const chunks = await searchChunks(question, 6);
  const usedKnowledge = chunks.length > 0;

  const sources: ChatSource[] = chunks.map((c, i) => ({
    n: i + 1,
    title: c.title || c.sourceName || "Untitled",
    sourceType: c.sourceType,
    sourceName: c.sourceName,
    url: c.url,
    snippet: c.text.length > 240 ? c.text.slice(0, 240) + "…" : c.text,
  }));

  const sourcesText = usedKnowledge
    ? contextBlock(chunks)
    : "(no relevant notes found in the knowledge base)";

  const client = new Anthropic({ apiKey });
  // Recent turns give follow-up questions context; cap to keep prompts lean.
  const priorTurns = history.slice(-8).map((t) => ({ role: t.role, content: t.content }));

  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    output_config: { effort: "low" },
    system,
    messages: [
      ...priorTurns,
      {
        role: "user",
        content: `SOURCES:\n${sourcesText}\n\nQUESTION: ${question}`,
      },
    ],
  });

  const answer =
    res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim() || "I couldn't find an answer to that.";

  return { answer, sources, usedKnowledge };
}
