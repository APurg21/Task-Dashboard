import { kv } from "@/lib/redis";
import { createHmac } from "crypto";
import type { NextRequest } from "next/server";
import { newId, type Task } from "@/lib/types";

const KEY = "tasks";
const DIAG_KEY = "sms:last"; // temporary diagnostic of the most recent inbound

// Keep only the last 10 digits so "+15551234567", "15551234567", "(555) 123-4567"
// all compare equal — avoids silent drops from formatting differences.
function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").slice(-10);
}

// Best-effort Twilio signature check. Twilio signs the exact configured URL +
// sorted POST params. On Vercel the host can be seen several ways, so try a few
// candidate URLs and accept if any matches. Returns true/false (never throws).
function signatureValid(req: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return false;

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const candidates = [
    `https://${host}/api/sms`,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/sms`
      : "",
    req.url,
  ].filter(Boolean);

  const params = Object.fromEntries(new URLSearchParams(body));
  const tail = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join("");

  return candidates.some((url) => {
    const expected = createHmac("sha1", authToken)
      .update(url + tail)
      .digest("base64");
    return expected === signature;
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);
  const from = params.get("From") ?? "";
  const text = (params.get("Body") ?? "").trim();

  const sigValid = signatureValid(req, rawBody);
  const myPhone = process.env.TWILIO_MY_PHONE ?? "";
  // Fail closed: no configured phone -> accept nothing. `From` is
  // attacker-supplied form data, so the allowlist alone is spoofable — the
  // Twilio signature is what proves the request really came from Twilio.
  const fromOk = Boolean(myPhone) && normalizePhone(from) === normalizePhone(myPhone);
  const accepted = Boolean(text) && fromOk && sigValid;

  if (accepted) {
    const tasks = (await kv.get<Task[]>(KEY)) ?? [];
    const task: Task = {
      id: newId(),
      title: text,
      status: "todo",
      priority: "medium",
      createdAt: Date.now(),
    };
    await kv.set(KEY, [task, ...tasks]);
  }

  // Temporary diagnostic so we can confirm exactly what Twilio delivered.
  await kv.set(DIAG_KEY, {
    from,
    text,
    sigValid,
    myPhoneConfigured: Boolean(myPhone),
    fromOk,
    accepted,
    at: Date.now(),
  });

  return new Response("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
