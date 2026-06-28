import Redis from "ioredis";

// Vercel's native Redis integration injects a TCP connection string as
// REDIS_URL (rediss://...). Reuse a single client across invocations.
const globalForRedis = globalThis as unknown as { redis?: Redis };

const client =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 3 });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = client;
else globalForRedis.redis = client;

// Thin wrapper so callers can store/read JSON the same way @vercel/kv did.
export const kv = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async set(key: string, value: unknown): Promise<void> {
    await client.set(key, JSON.stringify(value));
  },
};
