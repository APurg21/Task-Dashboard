import { kv } from "@vercel/kv";
import type { NextRequest } from "next/server";
import { newId, type Task } from "@/lib/types";

const KEY = "tasks";

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
  };
  await kv.set(KEY, [task, ...tasks]);
  return Response.json(task, { status: 201 });
}
