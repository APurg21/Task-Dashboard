// TEMPORARY diagnostic — returns the NAMES (never values) of storage-related
// env vars so we can confirm what the Vercel integration injected. Remove after.
export async function GET() {
  const names = Object.keys(process.env).filter((k) =>
    /UPSTASH|REDIS|KV_|STORAGE|TWILIO/i.test(k)
  );
  return Response.json({ present: names.sort() });
}
