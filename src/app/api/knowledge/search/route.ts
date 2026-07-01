import type { NextRequest } from "next/server";
import { searchChunks } from "@/lib/knowledge";

// Knowledge-base search for the Cosmic Command "Obsidian" adapter. Maps our
// retrieved chunks into the NoteHit shape the command-center UI expects.

export async function POST(req: NextRequest) {
  let body: { query?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return Response.json({ hits: [] });

  const chunks = await searchChunks(query, 8);
  const hits = chunks.map((c) => ({
    id: c.id,
    title: c.title || c.sourceName || "Note",
    excerpt: c.text.length > 260 ? c.text.slice(0, 260) + "…" : c.text,
    path: c.sourceName || c.sourceType || "knowledge base",
    editedLabel: c.sourceType || "note",
    score: c.rank,
  }));
  return Response.json({ hits });
}
