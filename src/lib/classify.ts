import Anthropic from "@anthropic-ai/sdk";
import {
  isNoteType,
  type LifeContext,
  type NoteClassification,
} from "./notes";
import type { Priority } from "./types";

// Shared server-side classifier. Both the note-capture route and the Telegram
// webhook funnel raw text through here so a captured thought and a texted task
// are triaged identically — type, personal/work context, priority, title, tags.

const SCHEMA = {
  type: "object",
  properties: {
    noteType: {
      type: "string",
      enum: ["current-project", "new-project", "brainstorm", "task", "daily"],
      description:
        "current-project: a task/update for an existing project. new-project: a brand-new project idea worth starting. brainstorm: an unstructured idea to explore later. task: a concrete actionable to-do. daily: a quick capture with no clear category.",
    },
    context: {
      type: "string",
      enum: ["personal", "work"],
      description: "Which side of life this belongs to.",
    },
    priority: {
      type: "string",
      enum: ["low", "medium", "high"],
      description:
        "Urgency. high for anything time-sensitive, deadline-driven, or marked urgent/ASAP. low for someday/maybe ideas. medium otherwise.",
    },
    title: {
      type: "string",
      description: "A short, specific title (3-8 words). No trailing punctuation.",
    },
    summary: {
      type: "string",
      description: "One sentence capturing the gist. Empty string if the note is already one short line.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "0-4 lowercase topic tags, no '#'.",
    },
    matchedProject: {
      type: "string",
      description:
        "If noteType is current-project and the note clearly belongs to one of the provided existing projects, the exact project name. Otherwise an empty string.",
    },
  },
  required: ["noteType", "context", "priority", "title", "summary", "tags", "matchedProject"],
  additionalProperties: false,
} as const;

export class MissingApiKeyError extends Error {}

const PRIORITIES = ["low", "medium", "high"];
const CONTEXTS = ["personal", "work"];

// Classify a piece of text. Throws MissingApiKeyError when no key is set so the
// caller can return a friendly 503; other Anthropic errors propagate.
export async function classifyText(
  text: string,
  projects: string[] = []
): Promise<NoteClassification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey });

  const projectContext = projects.length
    ? `Existing current projects the user is working on:\n${projects.map((p) => `- ${p}`).join("\n")}`
    : "The user has no existing projects on record yet.";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    system:
      "You triage a person's raw notes and texts into a personal+work dashboard that syncs to Obsidian. Decide where each note belongs, whether it's personal or work, how urgent it is, and give it a clean title. Be decisive; pick the single best value for each field.",
    messages: [
      {
        role: "user",
        content: `${projectContext}\n\nClassify this note:\n"""\n${text}\n"""`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  const jsonText = block && block.type === "text" ? block.text : "";
  const parsed = JSON.parse(jsonText) as NoteClassification;

  // Defensive normalization — never trust the fields blindly.
  if (!isNoteType(parsed.noteType)) parsed.noteType = "daily";
  parsed.context = (CONTEXTS.includes(parsed.context) ? parsed.context : "personal") as LifeContext;
  parsed.priority = (PRIORITIES.includes(parsed.priority) ? parsed.priority : "medium") as Priority;
  parsed.title = (parsed.title || "").trim() || "Untitled note";
  parsed.summary = parsed.summary || "";
  parsed.tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [];
  parsed.matchedProject = parsed.matchedProject || "";

  return parsed;
}
