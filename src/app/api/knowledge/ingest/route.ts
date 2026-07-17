import type { NextRequest } from "next/server";
import { ingestDocument, deleteBySourceId, chunkCount } from "@/lib/knowledge";

// Bulk knowledge ingest — the write path that lets the Obsidian vault (or any
// other corpus) flow into the Postgres knowledge base. Called by
// scripts/sync-vault.mjs from the machine that has the vault. Upserts by
// sourceId, so re-running a sync is always safe.
//
// Auth: bearer KNOWLEDGE_INGEST_SECRET. This route is excluded from the session
// gate in proxy.ts, so it MUST fail closed here.

export const maxDuration = 120;

interface IngestDoc {
  title?: string;
  content?: string;
  sourceType?: string;
  sourceName?: string;
  sourceId?: string;
  url?: string;
  context?: string;
  tags?: string[];
  delete?: boolean; // true -> remove this sourceId from the KB
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.KNOWLEDGE_INGEST_SECRET;
  if (!secret) return false; // fail closed
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { documents?: IngestDoc[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const docs = Array.isArray(body.documents) ? body.documents : [];
  if (!docs.length) return Response.json({ ok: true, results: [] });
  if (docs.length > 25) {
    return Response.json({ error: "Max 25 documents per request." }, { status: 400 });
  }

  const results: { sourceId: string | null; chunks: number; deleted?: boolean }[] = [];
  for (const d of docs) {
    if (d.delete && d.sourceId) {
      await deleteBySourceId(d.sourceId);
      results.push({ sourceId: d.sourceId, chunks: 0, deleted: true });
      continue;
    }
    const chunks = await ingestDocument({
      title: d.title || d.sourceId || "Untitled",
      content: d.content || "",
      sourceType: d.sourceType || "obsidian",
      sourceName: d.sourceName ?? d.title,
      sourceId: d.sourceId,
      url: d.url,
      context: d.context,
      tags: d.tags,
    });
    results.push({ sourceId: d.sourceId ?? null, chunks });
  }

  return Response.json({ ok: true, results, totalChunks: await chunkCount() });
}
