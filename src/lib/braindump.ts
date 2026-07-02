import Anthropic from "@anthropic-ai/sdk";
import { isNoteType, type LifeContext, type NoteClassification } from "./notes";
import { MissingApiKeyError } from "./classify";
import { ENTITY_TYPES, type EntityType, type Priority } from "./types";

// Brain-dump splitter + supertagger. A busy brain dumps in run-ons — "call the
// chamber back, book the Austin flight, hit the gym, and figure out 50/50
// pricing before Friday." This splits ONE message into every distinct item,
// classifies each, assigns a structured type (deal/person/idea/errand/…) with
// fields, and parses any due date so it's queryable and time-aware.

export type BrainItem = NoteClassification & {
  entityType: EntityType;
  fields: Record<string, string>;
  dueAt?: number;
};

const ITEM = {
  type: "object",
  properties: {
    noteType: { type: "string", enum: ["current-project", "new-project", "brainstorm", "task", "daily"] },
    entityType: {
      type: "string",
      enum: ENTITY_TYPES,
      description:
        "What the thing IS. deal: a sales opportunity/booking. person: a contact/relationship. errand: a personal chore. meeting: a scheduled sync. idea: something to explore. task: a generic to-do. note: a reference with no action.",
    },
    context: { type: "string", enum: ["personal", "work"] },
    priority: { type: "string", enum: ["low", "medium", "high"] },
    title: { type: "string", description: "Short, specific title (3-8 words), no trailing punctuation." },
    summary: { type: "string", description: "One sentence. Empty string if already one short line." },
    tags: { type: "array", items: { type: "string" }, description: "0-4 lowercase tags, no '#'." },
    fields: {
      type: "array",
      description: "0-6 structured key/value details worth tracking (e.g. contact, org, value, stage, where, when).",
      items: {
        type: "object",
        properties: { key: { type: "string" }, value: { type: "string" } },
        required: ["key", "value"],
        additionalProperties: false,
      },
    },
    due: { type: "string", description: "Due date as YYYY-MM-DD if the item names/implies one (resolve 'Friday' etc. from today's date), else empty string." },
    matchedProject: { type: "string", description: "Exact existing project name if it clearly belongs to one, else empty." },
  },
  required: ["noteType", "entityType", "context", "priority", "title", "summary", "tags", "fields", "due", "matchedProject"],
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

type RawItem = BrainItem & { fields?: unknown; due?: string };

function parseDue(due: string | undefined): number | undefined {
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return undefined;
  const t = Date.parse(due + "T09:00:00");
  return Number.isFinite(t) ? t : undefined;
}

function fieldsToRecord(fields: unknown): Record<string, string> {
  if (!Array.isArray(fields)) return {};
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f && typeof f === "object" && typeof (f as { key?: unknown }).key === "string") {
      const k = String((f as { key: string }).key).trim().slice(0, 40);
      const v = String((f as { value?: unknown }).value ?? "").trim().slice(0, 200);
      if (k && v) out[k] = v;
    }
  }
  return out;
}

function normalize(raw: RawItem): BrainItem {
  return {
    noteType: isNoteType(raw.noteType) ? raw.noteType : "daily",
    entityType: (ENTITY_TYPES as string[]).includes(raw.entityType) ? raw.entityType : "task",
    context: (CONTEXTS.includes(raw.context) ? raw.context : "personal") as LifeContext,
    priority: (PRIORITIES.includes(raw.priority) ? raw.priority : "medium") as Priority,
    title: (raw.title || "").trim() || "Untitled note",
    summary: raw.summary || "",
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 4) : [],
    matchedProject: raw.matchedProject || "",
    fields: fieldsToRecord(raw.fields),
    dueAt: parseDue(raw.due),
  };
}

// Split + classify a brain dump. Returns 1..N supertagged items. Throws
// MissingApiKeyError when no key is set.
export async function splitBrainDump(
  text: string,
  projects: string[] = []
): Promise<BrainItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey });
  const projectContext = projects.length
    ? `Existing current projects:\n${projects.map((p) => `- ${p}`).join("\n")}`
    : "The user has no existing projects on record yet.";
  const today = new Date().toISOString().slice(0, 10);

  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system:
      "You triage a person's raw brain dump into a personal+work dashboard. Split the message into every DISTINCT item — a run-on with several asks becomes several items; a single thought stays one. Don't invent or merge. For each: decide type (deal/person/errand/meeting/idea/task/note), personal/work, urgency, a clean title, useful structured fields (contact, org, value, stage, where…), and a due date if one is named or implied. Be decisive.",
    messages: [{ role: "user", content: `Today is ${today}.\n${projectContext}\n\nSplit and classify this brain dump:\n"""\n${text}\n"""` }],
  });

  const block = res.content.find((b) => b.type === "text");
  const jsonText = block && block.type === "text" ? block.text : "";
  const parsed = JSON.parse(jsonText) as { items?: RawItem[] };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const cleaned = items.map(normalize).filter((i) => i.title !== "Untitled note" || i.summary);
  if (!cleaned.length) {
    return [normalize({
      noteType: "daily", entityType: "note", context: "personal", priority: "medium",
      title: text.trim().slice(0, 60), summary: "", tags: [], matchedProject: "", fields: [], due: "",
    } as unknown as RawItem)];
  }
  return cleaned;
}
