import { NextRequest, NextResponse } from "next/server";

// Node runtime (not Edge): we need process.env + standard fetch, matching the
// other API routes in this app. Edge is deprecated by Vercel for new code anyway.
export const runtime = "nodejs";

/**
 * Reusable "ping my phone" channel. Sends a Telegram message to the locked
 * TELEGRAM_CHAT_ID using the bot token already configured in Vercel. This is the
 * system's permanent status-to-iPhone path (deploy notices, daily summaries,
 * approval requests can all reuse it).
 */
async function notify(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in env" };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const telegram = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, telegram };
}

// Gate on the existing TELEGRAM_SECRET_TOKEN (already set in Vercel) so we don't
// introduce a new secret. Accept it via ?key=, an x-notify-key header, or POST body.
function authorized(req: NextRequest, bodyKey?: string): boolean {
  const secret = process.env.TELEGRAM_SECRET_TOKEN;
  if (!secret) return false; // fail closed if no secret configured
  const url = new URL(req.url);
  const provided =
    url.searchParams.get("key") ?? bodyKey ?? req.headers.get("x-notify-key") ?? "";
  return provided === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const text = new URL(req.url).searchParams.get("text") || "✅ Task-Dashboard notify endpoint is live.";
  const result = await notify(text);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; key?: string };
  if (!authorized(req, body.key)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await notify(body.text || "✅ Task-Dashboard notify endpoint is live.");
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
