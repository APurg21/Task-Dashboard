// Note capture: drop free-form text, classify it with Claude, and file it into
// the right Obsidian folder. Kept separate from the Kanban `Task` type — a note
// is a thought destined for the vault, not a card on the board.

import type { Priority, NoteType, LifeContext } from "./types";

export type { NoteType, LifeContext } from "./types";

export interface NoteClassification {
  noteType: NoteType;
  // Which side of life this belongs to — drives the Personal/Work split view.
  context: LifeContext;
  // Inferred urgency, so a texted task lands at the right priority.
  priority: Priority;
  title: string;
  summary: string;
  tags: string[];
  // The project this note belongs to when noteType is "current-project",
  // chosen from the caller-supplied list. Empty string when none applies.
  matchedProject: string;
}

// Where each note type lands inside the vault. The leading folder is created
// on demand by the Obsidian REST API when the note is written.
export const NOTE_FOLDERS: Record<NoteType, string> = {
  "current-project": "Dashboard/Projects",
  "new-project": "Dashboard/New Ideas",
  brainstorm: "Dashboard/Brainstorm",
  task: "Dashboard/Tasks",
  daily: "Dashboard/Daily",
};

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  "current-project": "Current project",
  "new-project": "New project",
  brainstorm: "Brainstorm",
  task: "Task",
  daily: "Daily note",
};

export const NOTE_TYPES: NoteType[] = [
  "current-project",
  "new-project",
  "brainstorm",
  "task",
  "daily",
];

export function isNoteType(value: string): value is NoteType {
  return (NOTE_TYPES as string[]).includes(value);
}

// Strip characters Windows/Obsidian reject in filenames and clamp the length so
// the generated title makes a usable .md filename.
export function safeFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "Untitled note";
}

// Build the markdown file body with YAML frontmatter so Dataview can query it.
export function noteToMarkdown(
  c: NoteClassification,
  rawText: string,
  createdISO: string
): string {
  const tagList = c.tags.length ? c.tags.map((t) => `"${t}"`).join(", ") : "";
  const front = [
    "---",
    `title: "${c.title.replace(/"/g, "'")}"`,
    `type: ${c.noteType}`,
    `context: ${c.context}`,
    `priority: ${c.priority}`,
    `created: ${createdISO}`,
    c.matchedProject ? `project: "${c.matchedProject.replace(/"/g, "'")}"` : null,
    `tags: [${tagList}]`,
    "source: task-dashboard",
    "---",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const body = [
    `# ${c.title}`,
    "",
    c.summary ? `> ${c.summary}` : null,
    c.summary ? "" : null,
    rawText.trim(),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `${front}\n\n${body}\n`;
}
