import { kv } from "@/lib/redis";
import type { NextRequest } from "next/server";
import type { Task } from "@/lib/types";
import { sendTelegramMessage } from "@/lib/telegram";

// Daily morning brief. A Vercel cron hits this once a day; it picks the few
// tasks that matter, texts them to you, and remembers which it sent so you can
// reply "done 1" to check them off. This is the push that turns the system from
// something you have to remember to open into something that reaches out.

const KEY = "tasks";
const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

function ageDays(createdAt: number): number {
  const ms = createdAt > 1e14 ? createdAt / 1000 : createdAt;
  return Math.max(0, (Date.now() - ms) / 86_400_000);
}

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured — allow (Vercel cron + manual)
  const header = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  return header === `Bearer ${secret}` || key === secret;
}

async function buildAndSend(): Promise<{ ok: boolean; sent?: number; reason?: string }> {
  // Prefer the configured chat; otherwise fall back to the last chat that texted
  // the bot (recorded by the webhook) so the brief works with zero setup.
  const last = await kv.get<{ chatId?: number | string }>("telegram:last");
  const chatId = process.env.TELEGRAM_CHAT_ID || (last?.chatId != null ? String(last.chatId) : "");
  if (!chatId) {
    return { ok: false, reason: "No chat id — text your bot once (e.g. /id) so it knows who you are." };
  }

  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  const open = tasks.filter((t) => t.status !== "done");

  if (!open.length) {
    await sendTelegramMessage(
      chatId,
      "☀️ Morning. Clean slate — nothing on your board. Brain-dump whatever's on your mind and I'll sort it."
    );
    await kv.set(`brief:last:${chatId}`, []);
    return { ok: true, sent: 0 };
  }

  const ranked = [...open].sort((a, b) => {
    const r = (RANK[b.priority] ?? 0) - (RANK[a.priority] ?? 0);
    return r !== 0 ? r : b.createdAt - a.createdAt;
  });
  const top = ranked.slice(0, 3);

  const lines = top
    .map((t, i) => {
      const ctx = t.context === "work" ? "work" : "personal";
      const star = i === 0 ? "  ← start here" : "";
      return `${i + 1}. *${t.title}* (${ctx}/${t.priority})${star}`;
    })
    .join("\n");

  const stalled = open.filter((t) => ageDays(t.createdAt) > 7);
  const stalledLine = stalled.length
    ? `\n\n⏳ ${stalled.length} have been sitting a week: ${stalled.slice(0, 3).map((t) => t.title).join(", ")}.`
    : "";

  await sendTelegramMessage(
    chatId,
    `☀️ Morning. Here's today:\n\n${lines}${stalledLine}\n\nReply *done 1* (or *done 1 3*, *done all*) to check off.`
  );
  await kv.set(`brief:last:${chatId}`, top.map((t) => t.id));
  return { ok: true, sent: top.length };
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return new Response("forbidden", { status: 403 });
  const res = await buildAndSend();
  return Response.json(res, { status: res.ok ? 200 : 500 });
}
