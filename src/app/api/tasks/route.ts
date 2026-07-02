import { kv } from "@/lib/redis";
import type { NextRequest } from "next/server";
import { newId, ENTITY_TYPES, type Task, type LifeContext, type NoteType, type TaskSource, type EntityType } from "@/lib/types";

const KEY = "tasks";

const CONTEXTS: LifeContext[] = ["personal", "work"];
const NOTE_TYPES: NoteType[] = ["current-project", "new-project", "brainstorm", "task", "daily"];
const SOURCES: TaskSource[] = ["ui", "telegram", "import", "deep"];

function cleanFields(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k.slice(0, 40)] = val.slice(0, 200);
  }
  return Object.keys(out).length ? out : undefined;
}

export async function GET() {
  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  return Response.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return new Response("Title required", { status: 400 });

  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  const task: Task = {
    id: body.id ?? newId(),
    title,
    status: body.status ?? "todo",
    priority: body.priority ?? "medium",
    createdAt: body.createdAt ?? Date.now(),
    // Preserve enrichment so the personal/work split (and the command center's
    // Work vs Life panels) survive a board add — not just Telegram/capture.
    ...(CONTEXTS.includes(body.context) ? { context: body.context as LifeContext } : {}),
    ...(NOTE_TYPES.includes(body.noteType) ? { noteType: body.noteType as NoteType } : {}),
    ...(SOURCES.includes(body.source) ? { source: body.source as TaskSource } : {}),
    ...(typeof body.project === "string" ? { project: body.project } : {}),
    ...(typeof body.milestone === "string" ? { milestone: body.milestone } : {}),
    ...(ENTITY_TYPES.includes(body.entityType) ? { entityType: body.entityType as EntityType } : {}),
    ...(cleanFields(body.fields) ? { fields: cleanFields(body.fields) } : {}),
    ...(typeof body.dueAt === "number" ? { dueAt: body.dueAt } : {}),
  };
  await kv.set(KEY, [task, ...tasks]);
  return Response.json(task, { status: 201 });
}
