import { kv } from "@/lib/redis";
import type { NextRequest } from "next/server";
import { toMs, type Task } from "@/lib/types";
import { sendTelegramMessage } from "@/lib/telegram";

// Proactive nudge. A cron hits this during the day; it looks for things
// SLIPPING — overdue items, high-priority tasks going stale, deals/people gone
// quiet — and pings you only if there's something (no news = no ping). You can
// reply "done N" to clear or "draft N" to get a follow-up written in your voice.

const KEY = "tasks";

function ageDays(createdAt: number): number {
  return Math.max(0, (Date.now() - toMs(createdAt)) / 86_400_000);
}

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed — set CRON_SECRET (Vercel sends it as Bearer)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

interface Flag { task: Task; reason: string; weight: number }

async function run(): Promise<{ ok: boolean; nudged?: number; reason?: string }> {
  // Only ever message the configured chat — never a fallback stranger.
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (!chatId) return { ok: false, reason: "TELEGRAM_CHAT_ID is not set" };

  const now = Date.now();
  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  const open = tasks.filter((t) => t.status !== "done");

  const flags: Flag[] = [];
  for (const t of open) {
    // Don't re-nudge the same item within ~36h.
    if (t.nudgedAt && now - t.nudgedAt < 36 * 3_600_000) continue;
    const age = ageDays(t.createdAt);
    if (t.dueAt && t.dueAt < now) {
      flags.push({ task: t, reason: "overdue", weight: 4 });
    } else if ((t.entityType === "deal" || t.entityType === "person") && age > 5) {
      flags.push({ task: t, reason: `${t.entityType} quiet ${Math.round(age)}d`, weight: 3 });
    } else if (t.priority === "high" && age > 3) {
      flags.push({ task: t, reason: `high · ${Math.round(age)}d`, weight: 2 });
    }
  }

  if (!flags.length) return { ok: true, nudged: 0 };

  flags.sort((a, b) => b.weight - a.weight || ageDays(b.task.createdAt) - ageDays(a.task.createdAt));
  const top = flags.slice(0, 3);

  const lines = top.map((f, i) => `${i + 1}. *${f.task.title}* — ${f.reason}`).join("\n");
  await sendTelegramMessage(
    chatId,
    `⚡ Slipping through the cracks:\n${lines}\n\nReply *done N* to clear, or *draft N* for a follow-up in your voice.`
  );

  // Remember what we nudged (for done/draft) and stamp so we don't repeat.
  const nudgedIds = new Set(top.map((f) => f.task.id));
  const updated = tasks.map((t) => (nudgedIds.has(t.id) ? { ...t, nudgedAt: now } : t));
  await kv.set(KEY, updated);
  await kv.set(`brief:last:${chatId}`, top.map((f) => f.task.id));

  return { ok: true, nudged: top.length };
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return new Response("forbidden", { status: 403 });
  const res = await run();
  return Response.json(res, { status: res.ok ? 200 : 500 });
}
