import { kv } from "@vercel/kv";
import type { NextRequest } from "next/server";
import type { Task } from "@/lib/types";

const KEY = "tasks";

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const { id } = await ctx.params;
  const patch = await req.json();
  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  const updated = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  await kv.set(KEY, updated);
  return Response.json(updated.find((t) => t.id === id) ?? null);
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const { id } = await ctx.params;
  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  await kv.set(KEY, tasks.filter((t) => t.id !== id));
  return new Response(null, { status: 204 });
}
