import { after } from "next/server";
import type { NextRequest } from "next/server";
import { kv } from "@/lib/redis";
import { newId } from "@/lib/types";
import { jobKey, getJob, runDeepPlan, type DeepPlanJob } from "@/lib/deepPlanner";

// Start a deep (multi-agent) plan. Returns a jobId immediately; the orchestration
// runs after the response via after(), texting Telegram updates as it goes.
// GET ?id=<jobId> returns the job's current status for the dashboard to poll.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return new Response("text required", { status: 400 });

  const id = newId();
  const job: DeepPlanJob = {
    id,
    idea: text,
    status: "queued",
    message: "Queued…",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await kv.set(jobKey(id), job);

  // Runs in the background, kept alive up to maxDuration. Uses TELEGRAM_CHAT_ID
  // for updates so the dashboard trigger texts you too.
  after(async () => {
    await runDeepPlan(id, text);
  });

  return Response.json({ jobId: id });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });
  const job = await getJob(id);
  if (!job) return Response.json({ status: "unknown" }, { status: 404 });
  return Response.json(job);
}
