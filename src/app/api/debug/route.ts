// TEMPORARY diagnostic. Returns storage-related env var NAMES (never values)
// and the most recent inbound SMS payload so we can verify the Twilio path.
// Remove this route once everything works.
import { kv } from "@/lib/redis";

export async function GET() {
  const names = Object.keys(process.env).filter((k) =>
    /UPSTASH|REDIS|KV_|STORAGE|TWILIO|VERCEL_PROJECT_PRODUCTION_URL/i.test(k)
  );
  const lastSms = await kv.get("sms:last");
  return Response.json({ present: names.sort(), lastSms });
}
