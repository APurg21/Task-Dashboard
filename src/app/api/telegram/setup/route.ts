import type { NextRequest } from "next/server";

// Visit this once (in the browser) on the deployed app to point your Telegram
// bot's webhook at /api/telegram. Uses the current host as the public base URL.

export async function GET(req: NextRequest) {
  // Gate on the webhook secret: an open setup route would let anyone re-register
  // the webhook (dropping queued messages) at will.
  const expected = process.env.TELEGRAM_SECRET_TOKEN;
  if (!expected || req.headers.get("x-notify-key") !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json(
      { error: "TELEGRAM_BOT_TOKEN is not set. Add it to .env.local / Vercel env." },
      { status: 503 }
    );
  }

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (!host) {
    return Response.json({ error: "Could not determine host." }, { status: 400 });
  }

  const webhookUrl = `${proto}://${host}/api/telegram`;
  const secret = process.env.TELEGRAM_SECRET_TOKEN;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret || undefined,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  });

  const result = await res.json().catch(() => ({}));
  return Response.json({ webhookUrl, telegram: result }, { status: res.ok ? 200 : 502 });
}
