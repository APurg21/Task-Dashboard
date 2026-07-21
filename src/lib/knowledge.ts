import { sql } from "drizzle-orm";
import { getDb, hasDb } from "./db/client";
import { documents, documentChunks } from "./db/schema";

// Knowledge base: ingest text into Postgres, retrieve it with full-text search.
// Phase 1 is deliberately embedding-free — Postgres `tsvector` ranking over
// document_chunks.text. Everything here no-ops safely when DATABASE_URL is
// unset, so capture paths can call ingest without caring whether the KB exists.

export interface IngestInput {
  title: string;
  content: string;
  sourceType: string; // note | deep-plan | import | telegram | upload | ...
  sourceName?: string; // human label shown in citations
  sourceId?: string; // external id (telegram msg, obsidian path, job id)
  url?: string;
  context?: string; // personal | work
  tags?: string[];
}

export interface Retrieved {
  id: string;
  title: string | null;
  sourceType: string | null;
  sourceName: string | null;
  url: string | null;
  text: string;
  rank: number;
}

const CHUNK_TARGET = 900; // chars — roomy enough to keep an idea intact
const CHUNK_MAX = 1400;

// Split on blank lines, then pack paragraphs up to a target size so each chunk
// is a coherent passage rather than an arbitrary slice.
function chunkText(content: string): string[] {
  const paras = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (p.length > CHUNK_MAX) {
      if (buf) {
        chunks.push(buf);
        buf = "";
      }
      // Hard-wrap an oversized paragraph on sentence boundaries.
      let rest = p;
      while (rest.length > CHUNK_MAX) {
        const cut = rest.lastIndexOf(". ", CHUNK_MAX);
        const at = cut > CHUNK_TARGET ? cut + 1 : CHUNK_MAX;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) buf = rest;
      continue;
    }
    if (buf && buf.length + p.length + 2 > CHUNK_TARGET) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [content.trim()].filter(Boolean);
}

let ftsReady = false;

// Idempotent GIN index so full-text search stays fast as the vault grows.
async function ensureFtsIndex(db: ReturnType<typeof getDb>): Promise<void> {
  if (ftsReady) return;
  try {
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS document_chunks_fts_idx ON document_chunks USING GIN (to_tsvector('english', text))`
    );
    ftsReady = true;
  } catch {
    // Non-fatal: search still works without the index, just slower.
    ftsReady = true;
  }
}

// Remove every chunk (and parent document rows) previously stored for an
// external sourceId. This is what makes re-syncing the same Obsidian note an
// UPDATE instead of an ever-growing pile of duplicates.
export async function deleteBySourceId(sourceId: string): Promise<number> {
  if (!hasDb() || !sourceId) return 0;
  try {
    const db = getDb();
    const docs = await db.execute(
      sql`SELECT DISTINCT document_id AS id FROM document_chunks WHERE source_id = ${sourceId} AND document_id IS NOT NULL`
    );
    const deleted = await db.execute(
      sql`DELETE FROM document_chunks WHERE source_id = ${sourceId} RETURNING id`
    );
    const docIds = (docs as unknown as { id: string }[]).map((d) => d.id);
    if (docIds.length) {
      const idList = sql.join(docIds.map((id) => sql`${id}::uuid`), sql`, `);
      await db.execute(sql`DELETE FROM documents WHERE id IN (${idList})`);
    }
    return (deleted as unknown as unknown[]).length;
  } catch (err) {
    console.error("[knowledge] delete failed:", err);
    return 0;
  }
}

// Store a document and its chunks. When `sourceId` is set, existing chunks for
// that source are replaced (upsert) so re-ingesting a note never duplicates it.
// Returns the number of chunks written (0 when the KB is unavailable or there's
// nothing to store) — never throws to callers.
export async function ingestDocument(input: IngestInput): Promise<number> {
  if (!hasDb()) return 0;
  const content = (input.content || "").trim();
  if (!content) return 0;

  try {
    const db = getDb();
    await ensureFtsIndex(db);

    if (input.sourceId) await deleteBySourceId(input.sourceId);

    const [doc] = await db
      .insert(documents)
      .values({ title: input.title || null, content })
      .returning({ id: documents.id });

    const pieces = chunkText(content);
    const rows = pieces.map((text) => ({
      documentId: doc.id,
      sourceType: input.sourceType,
      sourceName: input.sourceName ?? input.title ?? null,
      sourceId: input.sourceId ?? null,
      title: input.title || null,
      text,
      url: input.url ?? null,
      tags: input.tags ?? null,
      permissionLevel: input.context === "work" ? "work" : "private",
    }));
    if (rows.length) await db.insert(documentChunks).values(rows);
    return rows.length;
  } catch (err) {
    console.error("[knowledge] ingest failed:", err);
    return 0;
  }
}

// Retrieve the most relevant chunks for a query. Full-text ranking first; if the
// tsquery matches nothing (rare terms, short notes), fall back to ILIKE over the
// query's words so we still surface something useful.
export async function searchChunks(query: string, limit = 6): Promise<Retrieved[]> {
  if (!hasDb()) return [];
  const q = query.trim();
  if (!q) return [];

  try {
    const db = getDb();

    const ranked = await db.execute(sql`
      SELECT id, title, source_type AS "sourceType", source_name AS "sourceName", url, text,
             ts_rank(to_tsvector('english', text), plainto_tsquery('english', ${q})) AS rank
      FROM document_chunks
      WHERE to_tsvector('english', text) @@ plainto_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    const rows = ranked as unknown as Retrieved[];
    if (rows.length) return rows;

    // Fallback: OR together ILIKE on each meaningful word.
    const words = q
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 8);
    if (!words.length) return [];
    const likes = sql.join(
      words.map((w) => sql`text ILIKE ${"%" + w + "%"}`),
      sql` OR `
    );
    const fallback = await db.execute(sql`
      SELECT id, title, source_type AS "sourceType", source_name AS "sourceName", url, text,
             0::real AS rank
      FROM document_chunks
      WHERE ${likes}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `);
    return fallback as unknown as Retrieved[];
  } catch (err) {
    console.error("[knowledge] search failed:", err);
    return [];
  }
}

// Delete all chunks for a given source id (e.g. a vault path) so re-ingesting an
// edited note replaces its chunks instead of duplicating them. No-op without a DB.
export async function deleteChunksBySourceId(sourceId: string): Promise<void> {
  if (!hasDb() || !sourceId) return;
  try {
    const db = getDb();
    // Remove the parent documents too, so repeated re-syncs don't strand
    // orphaned document rows (chunks carry the source_id; documents don't).
    await db.execute(
      sql`DELETE FROM documents WHERE id IN (SELECT document_id FROM document_chunks WHERE source_id = ${sourceId})`
    );
    await db.execute(sql`DELETE FROM document_chunks WHERE source_id = ${sourceId}`);
  } catch (err) {
    console.error("[knowledge] delete by source failed:", err);
  }
}

// Count stored chunks — used to tell the UI whether the KB has anything yet.
export async function chunkCount(): Promise<number> {
  if (!hasDb()) return 0;
  try {
    const db = getDb();
    const res = await db.execute(
      sql`SELECT count(*)::int AS n FROM document_chunks`
    );
    const rows = res as unknown as { n: number }[];
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
