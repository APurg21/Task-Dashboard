import { kv } from "@/lib/redis";
import type { NextRequest } from "next/server";
import { newId, type Task, type LifeContext, type NoteType, type TaskSource } from "@/lib/types";

const KEY = "tasks";

const CONTEXTS: LifeContext[] = ["personal", "work"];
const NOTE_TYPES: NoteType[] = ["current-project", "new-project", "brainstorm", "task", "daily"];
const SOURCES: TaskSource[] = ["ui", "telegram", "import", "deep"];

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
  };
  await kv.set(KEY, [task, ...tasks]);
  return Response.json(task, { status: 201 });
}
