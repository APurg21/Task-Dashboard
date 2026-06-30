import {
  pushNoteToVault,
  readPendingNotes,
  setPendingNotes,
  clearPendingNotes,
  ObsidianNotConfiguredError,
  ObsidianUnreachableError,
} from "@/lib/obsidian";

// Flush notes that were queued while the vault was unreachable (e.g. captured
// via Telegram on the deployed app) into the local Obsidian vault. Call this
// from the local dashboard, where localhost Obsidian is reachable.

// GET returns how many notes are waiting, so the dashboard can show a badge.
export async function GET() {
  const pending = await readPendingNotes();
  return Response.json({ pending: pending.length });
}

export async function POST() {
  const pending = await readPendingNotes();
  if (pending.length === 0) return Response.json({ ok: true, synced: 0, pending: 0 });

  const written: string[] = [];
  try {
    for (const note of pending) {
      const createdISO = new Date(note.at || Date.now()).toISOString();
      written.push(await pushNoteToVault(note.classification, note.text, createdISO));
    }
  } catch (err) {
    // Keep the unwritten remainder in the queue so nothing is lost on a retry.
    await setPendingNotes(pending.slice(written.length));
    if (err instanceof ObsidianNotConfiguredError || err instanceof ObsidianUnreachableError) {
      return Response.json(
        { error: err.message, synced: written.length, pending: pending.length - written.length },
        { status: 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Sync failed.";
    return Response.json({ error: message, synced: written.length }, { status: 502 });
  }

  await clearPendingNotes();
  return Response.json({ ok: true, synced: written.length, pending: 0, paths: written });
}
