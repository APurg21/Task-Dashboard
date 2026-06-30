import type { NextRequest } from "next/server";
import {
  pushNoteToVault,
  ObsidianNotConfiguredError,
  ObsidianUnreachableError,
} from "@/lib/obsidian";
import { isNoteType, type NoteClassification } from "@/lib/notes";

// Write a classified note into the Obsidian vault. Only works when the app and
// Obsidian run on the same machine — the plugin listens on localhost.

export async function POST(req: NextRequest) {
  let body: { classification?: NoteClassification; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const c = body.classification;
  const text = typeof body.text === "string" ? body.text : "";
  if (!c || !isNoteType(c.noteType) || !c.title || !text.trim()) {
    return new Response("classification and text required", { status: 400 });
  }

  try {
    const path = await pushNoteToVault(c, text, new Date().toISOString());
    return Response.json({ ok: true, path });
  } catch (err) {
    if (err instanceof ObsidianNotConfiguredError || err instanceof ObsidianUnreachableError) {
      return Response.json({ error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Push failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
