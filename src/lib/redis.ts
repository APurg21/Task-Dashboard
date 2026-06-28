import { Redis } from "@upstash/redis";

// Vercel's Upstash / Redis integrations inject the REST credentials under
// different env-var names depending on which integration variant was added.
// Accept all the common ones so storage works regardless.
const url =
  process.env.UPSTASH_REDIS_REST_URL ??
  process.env.KV_REST_API_URL ??
  process.env.STORAGE_REST_API_URL ??
  process.env.REDIS_REST_API_URL;

const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ??
  process.env.KV_REST_API_TOKEN ??
  process.env.STORAGE_REST_API_TOKEN ??
  process.env.REDIS_REST_API_TOKEN;

export const kv = new Redis({ url: url!, token: token! });
