import { kv } from "@/lib/redis";
import type { NextRequest } from "next/server";

// Server-persisted Command Center profile: the editable data behind every
// module that isn't already live (money, body, pipeline, travel, voice, week
// plan, …). Stored in Redis so the same profile shows up from any device.
// Shape = the command-center CommandCenterData (minus the task-derived Today
// lists, which are always overridden from the live board).

const KEY = "cc:profile";

export async function GET() {
  const profile = await kv.get<Record<string, unknown>>(KEY);
  return Response.json({ profile: profile ?? null });
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new Response("profile object required", { status: 400 });
  }
  await kv.set(KEY, body);
  return Response.json({ ok: true });
}
