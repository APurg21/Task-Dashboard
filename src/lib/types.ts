export type Status = "todo" | "doing" | "done";
export type Priority = "low" | "medium" | "high";

// Which side of life a task or note belongs to — drives the Personal/Work view.
export type LifeContext = "personal" | "work";

// Where a captured note is filed in Obsidian; also tags tasks by intent.
export type NoteType =
  | "current-project"
  | "new-project"
  | "brainstorm"
  | "task"
  | "daily";

// How a task entered the system, for display and debugging.
export type TaskSource = "ui" | "telegram" | "import" | "deep";

// Supertag — a structured type for a capture, so the brain is queryable
// ("show my open deals", "who do I owe a follow-up"). Beyond noteType, which is
// about where a note filed; entityType is about what the thing IS.
export type EntityType =
  | "task"
  | "deal"
  | "person"
  | "idea"
  | "errand"
  | "meeting"
  | "note";

export const ENTITY_TYPES: EntityType[] = [
  "task",
  "deal",
  "person",
  "idea",
  "errand",
  "meeting",
  "note",
];

export interface Task {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  createdAt: number;
  // Optional enrichment — present on AI-classified tasks (Telegram, capture),
  // absent on quick manual adds (which default to personal).
  context?: LifeContext;
  noteType?: NoteType;
  source?: TaskSource;
  // Set on tasks generated from a project plan, so the board can group them
  // under their project and milestone.
  project?: string;
  milestone?: string;
  // Supertag layer: a structured type + free-form fields (contact, value,
  // stage…) and an optional parsed due date, so the brain becomes a database.
  entityType?: EntityType;
  fields?: Record<string, string>;
  dueAt?: number;
  // When we last proactively nudged about this item (so we don't repeat).
  nudgedAt?: number;
}

export const STATUSES: { id: Status; label: string; accent: string }[] = [
  { id: "todo", label: "To Do", accent: "bg-zinc-400" },
  { id: "doing", label: "In Progress", accent: "bg-blue-500" },
  { id: "done", label: "Done", accent: "bg-emerald-500" },
];

export const PRIORITIES: Priority[] = ["low", "medium", "high"];

export function statusLabel(status: Status): string {
  return STATUSES.find((s) => s.id === status)?.label ?? status;
}

// createdAt stamps exist in two scales: ms (server writes) and ~µs
// (client/planner writes did Date.now()*1000). Normalize before ANY
// comparison, age math, or sort — comparing mixed scales silently breaks
// "done this week", stall detection, and recency ordering.
export function toMs(createdAt: number): number {
  return createdAt > 1e14 ? createdAt / 1000 : createdAt;
}

let counter = 0;
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `t_${Date.now().toString(36)}_${counter}`;
}
