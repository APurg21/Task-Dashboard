import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { kv } from "@/lib/redis";
import type { Task } from "@/lib/types";
import { MissingApiKeyError } from "@/lib/classify";
import { planProject, planToTasks, planToNote } from "@/lib/planner";
import { enqueuePendingNote } from "@/lib/obsidian";

// Generate a project plan from an idea, create its tasks on the board, and queue
// the project page for Obsidian. The plan is the expensive part, so it's always
// returned even if persistence degrades (e.g. Redis unreachable locally).

const KEY = "tasks";

export async function POST(req: NextRequest) {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return new Response("text required", { status: 400 });

  let plan;
  try {
    plan = await planProject(text);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return Response.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 503 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Anthropic API key is invalid." }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Planning failed.";
    return Response.json({ error: message }, { status: 502 });
  }

  const tasks = planToTasks(plan, "ui");

  let persisted = false;
  try {
    const existing = (await kv.get<Task[]>(KEY)) ?? [];
    await kv.set(KEY, [...tasks, ...existing]);
    await enqueuePendingNote({ ...planToNote(plan), at: Date.now() });
    persisted = true;
  } catch {
    // Keep the plan; surface that it wasn't saved (usually no local Redis).
  }

  return Response.json({
    plan,
    taskCount: tasks.length,
    milestoneCount: plan.milestones.length,
    persisted,
  });
}
