import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy Drizzle client. Connects on first use (not at import) so routes that
// don't touch the DB — and the build — never require DATABASE_URL. Uses
// prepare:false for Supabase's transaction pooler (pgbouncer).

let _db: PostgresJsDatabase<typeof schema> | null = null;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — add your Supabase connection string to .env.local.");
  }
  const client = postgres(url, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
