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
export type TaskSource = "ui" | "telegram" | "import";

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

let counter = 0;
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `t_${Date.now().toString(36)}_${counter}`;
}
