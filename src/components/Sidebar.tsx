"use client";

import { useCallback, useEffect, useState } from "react";

export type Section = "all" | "personal" | "work";

interface Props {
  section: Section;
  onSection: (s: Section) => void;
  counts: Record<Section, number>;
}

const SECTIONS: { id: Section; label: string }[] = [
  { id: "all", label: "All" },
  { id: "personal", label: "Personal" },
  { id: "work", label: "Work" },
];

// Sidebar shell: branding, the Personal/Work/All switcher (the primary nav),
// a placeholder for the future Finances panel, and the Obsidian sync control.
export default function Sidebar({ section, onSection, counts }: Props) {
  return (
    <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col lg:border-r lg:border-zinc-800 lg:bg-zinc-950">
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          L
        </div>
        <span className="text-base font-bold tracking-tight text-zinc-100">Life OS</span>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-2">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Workspace
        </p>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSection(s.id)}
            aria-current={section === s.id}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              section === s.id
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            }`}
          >
            <span>{s.label}</span>
            <span
              className={`rounded-full px-1.5 text-xs ${
                section === s.id ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {counts[s.id]}
            </span>
          </button>
        ))}
      </nav>

      <nav className="flex flex-col gap-1 px-3 py-2">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Coming soon
        </p>
        <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-600">
          <span>Finances</span>
          <span className="rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-500">soon</span>
        </div>
      </nav>

      <div className="mt-auto p-3">
        <ObsidianSync />
      </div>
    </aside>
  );
}

// Shows how many Telegram-captured notes are waiting and flushes them to the
// local vault on demand. Only succeeds when run locally with Obsidian open.
function ObsidianSync() {
  const [pending, setPending] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/notes/sync")
      .then((r) => r.json())
      .then((d) => setPending(typeof d.pending === "number" ? d.pending : 0))
      .catch(() => setPending(null));
  }, []);

  // Badge refresh only — ObsidianAutoSync (mounted in the root layout) already
  // polls AND flushes every 30s. A second flushing poller here raced it on the
  // same Redis queue, which could double-write or drop notes.
  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function sync() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/notes/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.synced > 0 ? `Synced ${data.synced}` : "Nothing to sync");
        setPending(0);
      } else {
        setStatus(data.error ? "Obsidian unreachable" : "Sync failed");
      }
    } catch {
      setStatus("Sync failed");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(null), 4000);
      refresh();
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Obsidian sync</span>
        {pending !== null && pending > 0 && (
          <span className="rounded-full bg-amber-500/20 px-1.5 text-[11px] font-medium text-amber-400">
            {pending}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        {status ?? (pending && pending > 0 ? `${pending} note${pending === 1 ? "" : "s"} from Telegram waiting` : "Vault up to date")}
      </p>
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="mt-2 w-full rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Syncing…" : "Sync to vault"}
      </button>
    </div>
  );
}
