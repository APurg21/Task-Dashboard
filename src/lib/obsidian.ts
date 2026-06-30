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

// Write one classified note to the vault. Returns the vault-relative path.
export async function pushNoteToVault(
  c: NoteClassification,
  text: string,
  createdISO: string
): Promise<string> {
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiKey) {
    throw new ObsidianNotConfiguredError(
      "OBSIDIAN_API_KEY is not set. Install the Obsidian 'Local REST API' plugin, copy its API key into .env.local, and make sure Obsidian is running."
    );
  }
  if (!isNoteType(c.noteType) || !c.title || !text.trim()) {
    throw new Error("classification and text required");
  }

  const base = (process.env.OBSIDIAN_API_URL || DEFAULT_BASE).replace(/\/+$/, "");
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
