import { Redis } from "@upstash/redis";
import { createHmac } from "crypto";
import type { NextRequest } from "next/server";
import { newId, type Task } from "@/lib/types";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const KEY = "tasks";

function validSignature(req: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // skip validation if not configured

  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/sms`
    : req.url;

  // Twilio signs: URL + sorted key=value pairs from POST body
  const params = Object.fromEntries(new URLSearchParams(body));
  const str =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");

  const expected = createHmac("sha1", authToken)
    .update(str)
    .digest("base64");

  return expected === signature;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!validSignature(req, rawBody)) {
    return new Response("<Response/>", {
      status: 403,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const params = new URLSearchParams(rawBody);
  const from = params.get("From") ?? "";
  const text = (params.get("Body") ?? "").trim();

  // Only accept texts from your own number
  const myPhone = process.env.TWILIO_MY_PHONE;
  if (myPhone && from !== myPhone) {
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  if (text) {
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

  // Empty TwiML response — no reply text sent back
  return new Response("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
