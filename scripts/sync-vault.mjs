// Sync the local Obsidian vault into the dashboard's Postgres knowledge base.
//
//   node scripts/sync-vault.mjs [--dry-run] [--full] [--vault <dir>] [--target <url>]
//
// Reads every .md note in the vault, skips unchanged ones via a local manifest
// (scripts/.vault-sync-manifest.json), and POSTs changed/new notes in batches
// to /api/knowledge/ingest, which upserts by vault-relative path. Notes deleted
// from the vault are removed from the KB. Re-running is always safe.
//
// Config (flags win over env, env wins over defaults):
//   KNOWLEDGE_INGEST_SECRET   required — same value as the Vercel env var
//   VAULT_DIR                 default: %USERPROFILE%\Documents\Obsidian Vault
//   SYNC_TARGET               default: https://task-dashboard-ap2tone.vercel.app
// Values are also picked up from .env.local if present.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const MANIFEST = join(scriptDir, ".vault-sync-manifest.json");

// ---- config -----------------------------------------------------------------

function loadDotEnvLocal() {
  const p = join(repoRoot, ".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const dotenv = loadDotEnvLocal();
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const has = (name) => args.includes(`--${name}`);

const VAULT =
  flag("vault") ??
  process.env.VAULT_DIR ??
  dotenv.VAULT_DIR ??
  join(os.homedir(), "Documents", "Obsidian Vault");
const TARGET = (
  flag("target") ??
  process.env.SYNC_TARGET ??
  dotenv.SYNC_TARGET ??
  "https://task-dashboard-ap2tone.vercel.app"
).replace(/\/+$/, "");
const SECRET = process.env.KNOWLEDGE_INGEST_SECRET ?? dotenv.KNOWLEDGE_INGEST_SECRET;
const DRY = has("dry-run");
const FULL = has("full"); // ignore the manifest, re-send everything

// Folders that hold no knowledge: app config, plugin prompts, binary attachments.
const SKIP_DIRS = new Set([".obsidian", ".trash", "copilot", "attachments"]);

// ---- vault walk -------------------------------------------------------------

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name.toLowerCase())) yield* walk(full);
    } else if (name.toLowerCase().endsWith(".md")) {
      yield full;
    }
  }
}

// Minimal frontmatter parse: leading --- block, `key: value` lines.
function parseNote(raw) {
  const fm = {};
  let body = raw;
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (kv) fm[kv[1].toLowerCase()] = kv[2].trim();
    }
  }
  return { fm, body: body.trim() };
}

function parseTags(fmTags) {
  if (!fmTags) return [];
  return fmTags
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().replace(/^["'#]|["']$/g, ""))
    .filter(Boolean);
}

// ---- main -------------------------------------------------------------------

if (!existsSync(VAULT)) {
  console.error(`Vault not found: ${VAULT}`);
  process.exit(1);
}
if (!SECRET && !DRY) {
  console.error(
    "KNOWLEDGE_INGEST_SECRET is not set (env or .env.local). Set it to the same value as the Vercel env var, or use --dry-run."
  );
  process.exit(1);
}

const manifest = FULL || !existsSync(MANIFEST) ? {} : JSON.parse(readFileSync(MANIFEST, "utf8"));
const seen = new Set();
const toSend = [];

for (const file of walk(VAULT)) {
  const rel = relative(VAULT, file).split(sep).join("/");
  seen.add(rel);
  const raw = readFileSync(file, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex");
  if (manifest[rel] === hash) continue;

  const { fm, body } = parseNote(raw);
  if (!body) continue; // empty note — nothing to index

  const topFolder = rel.includes("/") ? rel.slice(0, rel.indexOf("/")) : "root";
  const title = fm.title || rel.slice(rel.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  toSend.push({
    doc: {
      title,
      content: body,
      sourceType: fm.source || "obsidian",
      sourceName: title,
      sourceId: `vault:${rel}`,
      url: `obsidian://open?vault=Obsidian%20Vault&file=${encodeURIComponent(rel.replace(/\.md$/i, ""))}`,
      context: fm.context === "work" ? "work" : "personal",
      tags: [...new Set([topFolder.toLowerCase(), ...parseTags(fm.tags)])],
    },
    rel,
    hash,
    bytes: body.length,
  });
}

const deleted = Object.keys(manifest).filter((rel) => !seen.has(rel));

console.log(
  `${toSend.length} new/changed notes, ${deleted.length} deletions, ${seen.size} total notes in vault.`
);
if (DRY) {
  for (const t of toSend.slice(0, 20)) console.log(`  ~ ${t.rel} (${t.bytes} chars)`);
  if (toSend.length > 20) console.log(`  … and ${toSend.length - 20} more`);
  for (const rel of deleted) console.log(`  - ${rel}`);
  process.exit(0);
}

async function post(documents) {
  const res = await fetch(`${TARGET}/api/knowledge/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ documents }),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text().then((t) => t.slice(0, 300))}`);
  }
  return res.json();
}

// Batch by count and payload size so a batch never blows the function limit.
const BATCH_MAX = 15;
const BATCH_BYTES = 300_000;
let sent = 0;
let batch = [];
let batchBytes = 0;

async function flush() {
  if (!batch.length) return;
  const docs = batch.map((b) => b.doc);
  try {
    const out = await post(docs);
    for (const b of batch) manifest[b.rel] = b.hash;
    sent += batch.length;
    const chunks = (out.results ?? []).reduce((n, r) => n + (r.chunks || 0), 0);
    console.log(`  ✓ ${sent}/${toSend.length} notes (${chunks} chunks this batch, KB total ${out.totalChunks})`);
  } catch (err) {
    console.error(`  ✗ batch failed (${batch.length} notes): ${err.message}`);
    console.error(`    first note in failed batch: ${batch[0].rel}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  batch = [];
  batchBytes = 0;
}

for (const item of toSend) {
  if (batch.length >= BATCH_MAX || (batchBytes + item.bytes > BATCH_BYTES && batch.length)) {
    await flush();
  }
  batch.push(item);
  batchBytes += item.bytes;
}
await flush();

// Deletions — remove notes that no longer exist in the vault.
for (let i = 0; i < deleted.length; i += BATCH_MAX) {
  const slice = deleted.slice(i, i + BATCH_MAX);
  try {
    await post(slice.map((rel) => ({ sourceId: `vault:${rel}`, delete: true })));
    for (const rel of slice) delete manifest[rel];
    console.log(`  ✓ removed ${slice.length} deleted notes from KB`);
  } catch (err) {
    console.error(`  ✗ delete batch failed: ${err.message}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
}

console.log("Done.");
