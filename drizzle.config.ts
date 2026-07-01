import type { Config } from "drizzle-kit";

// drizzle-kit reads DATABASE_URL from the environment. Run migrations with:
//   npx dotenv -e .env.local -- drizzle-kit push
// (or export DATABASE_URL first). Push creates the tables in Supabase.

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
} satisfies Config;
