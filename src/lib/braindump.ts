import Anthropic from "@anthropic-ai/sdk";
import { isNoteType, type LifeContext, type NoteClassification } from "./notes";
import { MissingApiKeyError } from "./classify";
import type { Priority } from "./types";

// Brain-dump splitter. A busy brain dumps in run-ons — "call the chamber back,
// book the Austin flight, hit the gym, and figure out 50/50 pricing." This
// splits ONE message into every distinct item and classifies each, so a single
// text becomes the right set of tasks/notes instead of one blob. A single
// thought comes back as one item.

const ITEM = {
  type: "object",
  properties: {
    noteType: { type: "string", enum: ["current-project", "new-project", "brainstorm", "task", "daily"] },
    context: { type: "string", enum: ["personal", "work"] },
    priority: { type: "string", enum: ["low", "medium", "high"] },
    title: { type: "string", description: "Short, specific title (3-8 words), no trailing punctuation." },
    summary: { type: "string", description: "One sentence. Empty string if already one short line." },
    tags: { type: "array", items: { type: "string" }, description: "0-4 lowercase tags, no '#'." },
    matchedProject: { type: "string", description: "Exact existing project name if it clearly belongs to one, else empty." },
  },
  required: ["noteType", "context", "priority", "title", "summary", "tags", "matchedProject"],
  additionalProperties: false,
} as const;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "One entry per distinct actionable item or note in the message. A single thought → one entry.",
      items: ITEM,
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

const PRIORITIES = ["low", "medium", "high"];
const CONTEXTS = ["personal", "work"];

function normalize(raw: NoteClassification): NoteClassification {
  return {
    noteType: isNoteType(raw.noteType) ? raw.noteType : "daily",
    context: (CONTEXTS.includes(raw.context) ? raw.context : "personal") as LifeContext,
    priority: (PRIORITIES.includes(raw.priority) ? raw.priority : "medium") as Priority,
    title: (raw.title || "").trim() || "Untitled note",
    summary: raw.summary || "",
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 4) : [],
    matchedProject: raw.matchedProject || "",
  };
}

// Split + classify a brain dump. Returns 1..N items. Throws MissingApiKeyError
// when no key is set.
export async function splitBrainDump(
  text: string,
  projects: string[] = []
): Promise<NoteClassification[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey });
  const projectContext = projects.length
    ? `Existing current projects:\n${projects.map((p) => `- ${p}`).join("\n")}`
    : "The user has no existing projects on record yet.";

  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system:
      "You triage a person's raw brain dump into a personal+work dashboard. Split the message into every DISTINCT actionable item or note — a run-on with several asks becomes several items; a single thought stays one item. Don't invent items that aren't there, and don't merge unrelated ones. For each, decide type, personal/work, urgency, and a clean title. Be decisive.",
    messages: [{ role: "user", content: `${projectContext}\n\nSplit and classify this brain dump:\n"""\n${text}\n"""` }],
  });

  const block = res.content.find((b) => b.type === "text");
  const jsonText = block && block.type === "text" ? block.text : "";
  const parsed = JSON.parse(jsonText) as { items?: NoteClassification[] };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const cleaned = items.map(normalize).filter((i) => i.title !== "Untitled note" || i.summary);
  // Never return empty — fall back to a single daily capture of the raw text.
  if (!cleaned.length) {
    return [normalize({ noteType: "daily", context: "personal", priority: "medium", title: text.trim().slice(0, 60), summary: "", tags: [], matchedProject: "" })];
  }
  return cleaned;
}
