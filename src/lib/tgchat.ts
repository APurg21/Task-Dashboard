import Anthropic from "@anthropic-ai/sdk";
import { kv } from "./redis";
import { sendTelegramMessage } from "./telegram";
import { getChiefStyle } from "./chat";
import type { Task } from "./types";

// Conversational Telegram mode. The bot chats back and forth with context of
// your current tasks, and saves NOTHING to the board — capture only happens via
// the explicit task:/plan:/deepplan: commands. Recent turns are kept in Redis
// just for conversation continuity (not tasks).

type Turn = { role: "user" | "assistant"; content: string };

const HIST_KEY = (id: number | string) => `tg:chat:${id}`;
const MODE_KEY = (id: number | string) => `tg:mode:${id}`;
const TASKS_KEY = "tasks";
const MAX_TURNS = 12;

export type ChatMode = "chat" | "capture";

export async function getMode(chatId: number | string): Promise<ChatMode> {
  return (await kv.get<ChatMode>(MODE_KEY(chatId))) ?? "capture";
}
export async function setMode(chatId: number | string, mode: ChatMode): Promise<void> {
  await kv.set(MODE_KEY(chatId), mode);
}
export async function clearTelegramChat(chatId: number | string): Promise<void> {
  await kv.set(HIST_KEY(chatId), []);
}

export async function telegramChat(chatId: number | string, text: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await sendTelegramMessage(chatId, "⚠️ Chat isn't configured (no ANTHROPIC_API_KEY).");
    return;
  }
  const client = new Anthropic({ apiKey });

  const history = (await kv.get<Turn[]>(HIST_KEY(chatId))) ?? [];
  const tasks = (await kv.get<Task[]>(TASKS_KEY)) ?? [];
  const open = tasks
    .filter((t) => t.status !== "done")
    .slice(0, 40)
    .map((t) => `- [${t.priority}] ${t.title}${t.context ? ` (${t.context})` : ""}`)
    .join("\n");

  const messages: Turn[] = [...history, { role: "user", content: text }];

  const voice = await getChiefStyle();
  const system =
    "You are the user's work assistant, chatting over Telegram. Be concise, direct, and practical — short messages, not essays. You can see their current open tasks below; reference them when useful. This is a conversation: do NOT invent that you saved anything. You cannot take actions here. If the user clearly wants to capture something, tell them to prefix it with `task:` (a task), `plan:` (a quick plan), or `deepplan:` (a deep multi-agent plan)." +
    (voice ? "\n\nVOICE — this is how the user wants you to talk to them; follow it closely:\n" + voice : "") +
    "\n\nCurrent open tasks:\n" + (open || "(none)");

  let reply = "…";
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system,
      messages,
    });
    reply =
      res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim() || "…";
  } catch {
    reply = "Hit a snag answering that — try again in a sec.";
  }

  const next = [...messages, { role: "assistant" as const, content: reply }].slice(-MAX_TURNS * 2);
  await kv.set(HIST_KEY(chatId), next);
  await sendTelegramMessage(chatId, reply);
}
