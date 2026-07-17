import Redis from "ioredis";

// Vercel's native Redis integration injects a TCP connection string as
// REDIS_URL (rediss://...). Reuse a single client across invocations.
// lazyConnect: the build (and any route that never touches Redis) must not
// open a socket at import time — that's what spammed the build log with
// unhandled AggregateErrors when REDIS_URL was unset locally.
const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  // Without a listener, a connection failure is an unhandled error event that
  // can crash the process instead of surfacing as a rejected command.
  client.on("error", (err) => {
    console.error("[redis]", err.message);
  });
  return client;
}

const client = globalForRedis.redis ?? createClient();
globalForRedis.redis = client;

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
