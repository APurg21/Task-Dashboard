import { createHash } from "node:crypto";
import {
  listVaultMarkdown,
  readVaultFile,
  parseVaultNote,
  ObsidianNotConfiguredError,
  ObsidianUnreachableError,
} from "@/lib/obsidian";
import { ingestDocument, deleteBySourceId, chunkCount } from "@/lib/knowledge";
import { kv } from "@/lib/redis";

// Read the Obsidian vault into the knowledge base so AI Chat grounds answers in
// your real notes. Incremental: each file's content hash is remembered in Redis,
// so unchanged notes are skipped and notes deleted from the vault are purged
// from the KB. Frontmatter (context/tags/project) is parsed into chunk metadata
// instead of being ingested as prose.
//
// LOCAL ONLY: the Local REST API plugin listens on localhost, so this runs from
// the dashboard on the same machine as Obsidian (ObsidianAutoSync triggers it
// automatically). The deployed site can't reach your vault — but the resulting
// chunks live in Postgres, so deployed chat still reads everything synced here.

export const maxDuration = 300;

const HASH_KEY = "obsidian:vaultHashes";

export async function POST() {
  let paths: string[];
  try {
    paths = await listVaultMarkdown(""); // whole vault
  } catch (err) {
    return errorResponse(err);
  }

  const prev = (await kv.get<Record<string, string>>(HASH_KEY)) ?? {};
  const next: Record<string, string> = {};

  let ingested = 0;
  let unchanged = 0;
  let skipped = 0;
  let chunks = 0;
  const failures: string[] = [];

  for (const path of paths) {
    try {
      const raw = await readVaultFile(path);
      const hash = createHash("sha256").update(raw).digest("hex");

      if (prev[path] === hash) {
        next[path] = hash;
        unchanged++;
        continue;
      }

      const { body, context, tags } = parseVaultNote(raw);
      if (!body.trim()) {
        next[path] = hash; // remember it so empty files aren't re-read as "new"
        skipped++;
        continue;
      }

      // sourceId matches scripts/sync-vault.mjs keying (`vault:` + relative
      // path) so either sync path upserts the same rows — never duplicates.
      // ingestDocument replaces existing chunks for the sourceId itself.
      const n = await ingestDocument({
        title: path.split("/").pop()!.replace(/\.md$/, ""),
        content: body,
        sourceType: "obsidian",
        sourceName: path,
        sourceId: `vault:${path}`,
        context,
        tags: tags.length ? tags : undefined,
      });
      if (n > 0) {
        next[path] = hash; // only mark done on success, so failures retry next run
        ingested++;
        chunks += n;
      } else {
        skipped++;
      }
    } catch (err) {
      // One bad file shouldn't abort the sync; leave its hash unset so it retries.
      failures.push(path);
      console.error(`[ingest/obsidian] ${path} failed:`, err);
    }
  }

  // Notes deleted from the vault → purge their chunks from the KB.
  let removed = 0;
  for (const oldPath of Object.keys(prev)) {
    if (!(oldPath in next)) {
      await deleteBySourceId(`vault:${oldPath}`);
      removed++;
    }
  }

  await kv.set(HASH_KEY, next);

  const total = await chunkCount();
  return Response.json({
    ok: true,
    files: paths.length,
    ingested,
    unchanged,
    skipped,
    removed,
    chunks,
    totalChunks: total,
    failures,
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof ObsidianNotConfiguredError || err instanceof ObsidianUnreachableError) {
    return Response.json({ error: err.message }, { status: 502 });
  }
  const message = err instanceof Error ? err.message : "Vault ingestion failed.";
  return Response.json({ error: message }, { status: 500 });
}
