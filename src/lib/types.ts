export type Status = "todo" | "doing" | "done";
export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  createdAt: number;
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
