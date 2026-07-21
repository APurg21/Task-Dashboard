import { kv } from "./redis";
import {
  isNoteType,
  noteToMarkdown,
  safeFileName,
  NOTE_FOLDERS,
  type NoteClassification,
} from "./notes";

// Server-side Obsidian integration: write a classified note into the vault via
// the Local REST API plugin, plus a Redis-backed queue for notes that arrive
// when the vault isn't reachable (e.g. a Telegram message hitting the deployed
// app, which can't see your local Obsidian). The local app flushes the queue.

const DEFAULT_BASE = "http://127.0.0.1:27123";
const PENDING_KEY = "obsidian:pending";
const PENDING_CAP = 200;

export interface PendingNote {
  classification: NoteClassification;
  text: string;
  at: number;
}

export class ObsidianNotConfiguredError extends Error {}
export class ObsidianUnreachableError extends Error {}

// Shared connection: base URL + API key, or a clear NotConfigured error. Used by
// both the write path (pushNoteToVault) and the read path (vault ingestion).
function obsidianConn(): { base: string; apiKey: string } {
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiKey) {
    throw new ObsidianNotConfiguredError(
      "OBSIDIAN_API_KEY is not set. Install the Obsidian 'Local REST API' plugin, copy its API key into .env.local, and make sure Obsidian is running."
    );
  }
  const base = (process.env.OBSIDIAN_API_URL || DEFAULT_BASE).replace(/\/+$/, "");
  return { base, apiKey };
}

// Turn a fetch/connection failure into a friendly "vault unreachable" error;
// re-throw anything that isn't a connection problem.
function asUnreachable(err: unknown): never {
  const isConn =
    err instanceof Error &&
    (err.name === "TimeoutError" ||
      /ECONNREFUSED|fetch failed|network/i.test(err.message));
  if (isConn) {
    throw new ObsidianUnreachableError(
      "Couldn't reach Obsidian. Make sure Obsidian is running with the Local REST API plugin enabled (HTTP server on, port 27123)."
    );
  }
  throw err;
}

// Recursively list every .md path under a vault folder. "" = whole vault. The
// Local REST API returns a folder's entries on GET /vault/{dir}/ (trailing
// slash); sub-folders come back with a trailing "/".
export async function listVaultMarkdown(dir = ""): Promise<string[]> {
  const { base, apiKey } = obsidianConn();
  const encodedDir = dir.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const url = `${base}/vault/${encodedDir}${dir ? "/" : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    asUnreachable(err);
  }
  if (!res.ok) throw new Error(`Couldn't list vault folder "${dir}" (${res.status}).`);

  const { files } = (await res.json()) as { files: string[] };
  const out: string[] = [];
  for (const entry of files) {
    const name = entry.replace(/\/$/, "");
    const path = dir ? `${dir}/${name}` : name;
    if (entry.endsWith("/")) {
      out.push(...(await listVaultMarkdown(path)));
    } else if (entry.endsWith(".md")) {
      out.push(path);
    }
  }
  return out;
}

// Read one vault file's raw markdown.
export async function readVaultFile(path: string): Promise<string> {
  const { base, apiKey } = obsidianConn();
  const url = `${base}/vault/${path.split("/").map(encodeURIComponent).join("/")}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    asUnreachable(err);
  }
  if (!res.ok) throw new Error(`Couldn't read vault file "${path}" (${res.status}).`);
  return res.text();
}

// Strip leading YAML frontmatter so ingested chunks are prose, not metadata.
// Handles both LF and CRLF line endings (Obsidian on Windows writes CRLF).
export function stripFrontmatter(md: string): string {
  return md.startsWith("---")
    ? md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    : md;
}

export interface ParsedVaultNote {
  body: string;
  // From frontmatter when present: `context: work|personal` drives the KB's
  // work/private permission split; tags + project become chunk tags.
  context?: "work" | "personal";
  tags: string[];
}

// Pull the metadata our notes carry (see noteToMarkdown) out of a vault file's
// frontmatter instead of discarding it. Light regex parse, not a YAML library —
// good enough for the flat `key: value` frontmatter Obsidian notes use.
export function parseVaultNote(md: string): ParsedVaultNote {
  const body = stripFrontmatter(md);
  if (body === md) return { body, tags: [] };

  const front = md.slice(0, md.length - body.length);
  const tags: string[] = [];

  const ctx = front.match(/^context:\s*["']?(work|personal)["']?\s*$/im)?.[1];

  // tags: ["a", "b"] (our notes) or tags: [a, b]
  const tagList = front.match(/^tags:\s*\[([^\]]*)\]/im)?.[1];
  if (tagList) {
    for (const t of tagList.split(",")) {
      const clean = t.trim().replace(/^["']|["']$/g, "");
      if (clean) tags.push(clean);
    }
  }

  // project: "Name" → a tag, so project notes are filterable in retrieval.
  const project = front.match(/^project:\s*["']?([^"'\r\n]+)["']?\s*$/im)?.[1]?.trim();
  if (project) tags.push(project);

  return {
    body,
    context: ctx ? (ctx.toLowerCase() as "work" | "personal") : undefined,
    tags,
  };
}

// Write one classified note to the vault. Returns the vault-relative path.
export async function pushNoteToVault(
  c: NoteClassification,
  text: string,
  createdISO: string
): Promise<string> {
  if (!isNoteType(c.noteType) || !c.title || !text.trim()) {
    throw new Error("classification and text required");
  }

  const { base, apiKey } = obsidianConn();
  const folder = NOTE_FOLDERS[c.noteType];
  const fileName = `${safeFileName(c.title)}.md`;
  const vaultPath = `${folder}/${fileName}`;
  const markdown = noteToMarkdown(c, text, createdISO);
  const url = `${base}/vault/${vaultPath.split("/").map(encodeURIComponent).join("/")}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "text/markdown",
      },
      body: markdown,
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    asUnreachable(err);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Obsidian rejected the write (${res.status}). ${detail}`.trim());
  }

  return vaultPath;
}

// Queue a note for later sync (used when the vault isn't reachable from here).
export async function enqueuePendingNote(note: PendingNote): Promise<void> {
  const pending = (await kv.get<PendingNote[]>(PENDING_KEY)) ?? [];
  pending.push(note);
  // Keep the queue bounded; drop the oldest if it ever runs away.
  const trimmed = pending.slice(-PENDING_CAP);
  await kv.set(PENDING_KEY, trimmed);
}

export async function readPendingNotes(): Promise<PendingNote[]> {
  return (await kv.get<PendingNote[]>(PENDING_KEY)) ?? [];
}

export async function setPendingNotes(notes: PendingNote[]): Promise<void> {
  await kv.set(PENDING_KEY, notes);
}

export async function clearPendingNotes(): Promise<void> {
  await kv.set(PENDING_KEY, []);
}
