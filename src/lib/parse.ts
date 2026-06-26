import { Priority, Status } from "./types";

export interface ParsedTask {
  title: string;
  status?: Status;
  priority?: Priority;
}

const STATUS_SYNONYMS: Record<string, Status> = {
  todo: "todo",
  "to do": "todo",
  "to-do": "todo",
  backlog: "todo",
  new: "todo",
  open: "todo",
  "not started": "todo",
  pending: "todo",
  doing: "doing",
  "in progress": "doing",
  "in-progress": "doing",
  inprogress: "doing",
  wip: "doing",
  started: "doing",
  active: "doing",
  progress: "doing",
  done: "done",
  complete: "done",
  completed: "done",
  finished: "done",
  closed: "done",
  resolved: "done",
};

const PRIORITY_SYNONYMS: Record<string, Priority> = {
  high: "high",
  urgent: "high",
  critical: "high",
  p1: "high",
  h: "high",
  medium: "medium",
  med: "medium",
  normal: "medium",
  p2: "medium",
  m: "medium",
  low: "low",
  minor: "low",
  p3: "low",
  l: "low",
};

export function normalizeStatus(value: string): Status | undefined {
  return STATUS_SYNONYMS[value.trim().toLowerCase()];
}

export function normalizePriority(value: string): Priority | undefined {
  return PRIORITY_SYNONYMS[value.trim().toLowerCase()];
}

/** Split a single CSV line into fields, honoring double-quoted values. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/** Strip list markers (bullets, numbering, checkboxes) and detect a done checkbox. */
function stripListMarker(line: string): { title: string; done: boolean } {
  let done = false;
  let rest = line.replace(/^\s*[-*+•]\s*/, "");
  const checkbox = rest.match(/^\[([ xX])\]\s*/);
  if (checkbox) {
    if (checkbox[1].toLowerCase() === "x") done = true;
    rest = rest.slice(checkbox[0].length);
  } else {
    rest = rest.replace(/^\s*\d+[.)]\s*/, "");
  }
  return { title: rest.trim(), done };
}

function findColumn(headers: string[], names: string[]): number {
  return headers.findIndex((h) => names.includes(h.trim().toLowerCase()));
}

/**
 * Parse pasted text into tasks. Auto-detects CSV (multi-column, with optional
 * header) versus a plain list (one task per line, bullets/checkboxes allowed).
 */
export function parseImport(text: string): ParsedTask[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) return [];

  const rows = rawLines.map(splitCsvLine);
  const maxCols = Math.max(...rows.map((r) => r.length));

  // Single column everywhere -> treat as a plain list.
  if (maxCols <= 1) {
    return rawLines.map((line) => {
      const { title, done } = stripListMarker(line);
      return done ? { title, status: "done" as Status } : { title };
    }).filter((t) => t.title.length > 0);
  }

  // Multi-column -> CSV. Detect a header row by known column names.
  const header = rows[0].map((h) => h.toLowerCase());
  const titleCol = findColumn(header, ["title", "task", "name", "todo", "item", "description"]);
  const statusCol = findColumn(header, ["status", "state", "column", "stage"]);
  const priorityCol = findColumn(header, ["priority", "prio", "importance"]);
  const hasHeader = titleCol !== -1 || statusCol !== -1 || priorityCol !== -1;

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const tIdx = titleCol === -1 ? 0 : titleCol;

  return dataRows
    .map((cols): ParsedTask | null => {
      const title = (cols[tIdx] ?? "").trim();
      if (!title) return null;
      const task: ParsedTask = { title };
      if (statusCol !== -1 && cols[statusCol]) {
        const s = normalizeStatus(cols[statusCol]);
        if (s) task.status = s;
      }
      if (priorityCol !== -1 && cols[priorityCol]) {
        const p = normalizePriority(cols[priorityCol]);
        if (p) task.priority = p;
      }
      return task;
    })
    .filter((t): t is ParsedTask => t !== null);
}
