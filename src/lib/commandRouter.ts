import { kv } from "./redis";
import { newId, type Task, type TaskSource } from "./types";
import { MissingApiKeyError } from "./classify";
import { splitBrainDump, type BrainItem } from "./braindump";
import { enqueuePendingNote } from "./obsidian";
import { ingestDocument } from "./knowledge";
import { planProject, planToTasks, planToNote, type ProjectPlan } from "./planner";
import { jobKey, type DeepPlanJob } from "./deepPlanner";

// Transport-agnostic command core. The capture verbs (task:/plan:/deepplan:)
// used to live inline in the Telegram webhook; extracted here so the dashboard's
// Chief-of-Staff box runs the exact same pipelines. Each transport keeps its own
// parsing order and reply formatting — this module owns the business logic only:
// board writes, Obsidian queueing, and knowledge-base ingestion.

const KEY = "tasks";

// ---------- verb parsing (dashboard entry point) ----------
// Mirrors the webhook's per-verb regexes exactly: `verb:` or `/verb`, arg required.

export type Verb = "task" | "plan" | "deepplan" | "ask";

const VERB_RES: [Verb, RegExp][] = [
  ["ask", /^(?:\/ask|ask:)\s*([\s\S]+)$/i],
  ["deepplan", /^(?:\/deepplan|deepplan:)\s*([\s\S]+)$/i],
  ["plan", /^(?:\/plan|plan:)\s*([\s\S]+)$/i],
  ["task", /^(?:\/task|task:)\s*([\s\S]+)$/i],
];

export function parseVerb(text: string): { verb: Verb; arg: string } | null {
  for (const [verb, re] of VERB_RES) {
    const m = text.match(re);
    if (m) return { verb, arg: m[1].trim() };
  }
  return null;
}

// ---------- task: capture ----------
// Split a brain dump, save every item to the board, queue each for Obsidian,
// ingest each into the KB. Throws MissingApiKeyError; any other split failure
// degrades to a single plain task so nothing is lost.

export interface CaptureOutcome {
  items: BrainItem[] | null;
  fallbackTask?: Task;
}

export async function captureToBoard(
  captureText: string,
  source: TaskSource
): Promise<CaptureOutcome> {
  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  // Current active task titles double as project context for matching.
  const projects = tasks.filter((t) => t.status !== "done").map((t) => t.title);

  let items: BrainItem[];
  try {
    items = await splitBrainDump(captureText, projects);
  } catch (err) {
    if (err instanceof MissingApiKeyError) throw err;
    const task: Task = {
      id: newId(), title: captureText, status: "todo", priority: "medium",
      createdAt: Date.now(), source,
    };
    await kv.set(KEY, [task, ...tasks]);
    return { items: null, fallbackTask: task };
  }

  const now = Date.now();
  const single = items.length === 1;
  const newTasks: Task[] = items.map((c, i) => ({
    id: newId(),
    title: c.title,
    status: "todo",
    priority: c.priority,
    createdAt: now + (items.length - i), // preserve dump order (newest-first list)
    context: c.context,
    noteType: c.noteType,
    source,
    entityType: c.entityType,
    ...(Object.keys(c.fields).length ? { fields: c.fields } : {}),
    ...(c.dueAt ? { dueAt: c.dueAt } : {}),
    ...(c.matchedProject ? { project: c.matchedProject } : {}),
  }));
  await kv.set(KEY, [...newTasks, ...tasks]);

  // Queue each note for Obsidian + file each in the knowledge base. For a single
  // capture keep the full original text; for a split use the item's own content.
  for (const c of items) {
    const body = single ? captureText : [c.title, c.summary].filter(Boolean).join(" — ");
    await enqueuePendingNote({ classification: c, text: body, at: Date.now() });
    await ingestDocument({
      title: c.title, content: body, sourceType: source,
      sourceName: c.title, context: c.context, tags: [c.entityType, ...c.tags],
    });
  }

  return { items };
}

// ---------- plan: quick plan ----------
// Idea → milestones + tasks on the board, plan note queued for the vault.

export async function quickPlanToBoard(
  idea: string,
  source: TaskSource
): Promise<{ plan: ProjectPlan; taskCount: number }> {
  const plan = await planProject(idea);
  const planned = planToTasks(plan, source);
  const existing = (await kv.get<Task[]>(KEY)) ?? [];
  await kv.set(KEY, [...planned, ...existing]);
  await enqueuePendingNote({ ...planToNote(plan), at: Date.now() });
  return { plan, taskCount: planned.length };
}

// ---------- deepplan: job creation ----------
// Creates + persists the queued job and returns its id. The caller schedules
// runDeepPlan via after() — background scheduling stays transport-side.

export async function queueDeepPlan(idea: string): Promise<string> {
  const id = newId();
  const job: DeepPlanJob = {
    id, idea, status: "queued", message: "Queued…",
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await kv.set(jobKey(id), job);
  return id;
}
