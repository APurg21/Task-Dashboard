"use client";

import { useEffect } from "react";

// Headless auto-sync for Obsidian. Notes captured from anywhere (Telegram, the
// dashboard, the command center) queue in Redis; only a machine running the app
// locally can flush them to the vault (the plugin listens on localhost). This
// polls the queue and flushes it automatically whenever the LOCAL app is open,
// on any page — so you never have to remember the "Sync to vault" button.
//
// Gated to localhost: on the deployed site the flush can't reach your vault, so
// there's no point trying (and no error noise).

const INTERVAL_MS = 30_000;
// Vault → knowledge base ingest is incremental (hash-skips unchanged notes), so
// an hourly cadence keeps AI Chat current without hammering Obsidian or the DB.
const INGEST_INTERVAL_MS = 60 * 60_000;

// Module-level so StrictMode's double-mounted effect instances share the guard.
let ingestInFlight = false;

export default function ObsidianAutoSync() {
  useEffect(() => {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return;

    let stopped = false;

    async function tick() {
      try {
        const count = await fetch("/api/notes/sync").then((r) => r.json());
        if (!stopped && typeof count.pending === "number" && count.pending > 0) {
          await fetch("/api/notes/sync", { method: "POST" });
        }
      } catch {
        // Obsidian not reachable right now — try again next tick.
      }
    }

    async function ingestTick() {
      // Guard against overlapping runs (React StrictMode double-mounts in dev,
      // or a slow first sync outlasting the interval).
      if (ingestInFlight) return;
      ingestInFlight = true;
      try {
        // Reads the whole vault into the knowledge base; unchanged notes skip.
        await fetch("/api/ingest/obsidian", { method: "POST" });
      } catch {
        // Obsidian closed — the next tick (or the manual button) catches up.
      } finally {
        ingestInFlight = false;
      }
    }

    tick(); // flush anything waiting on load
    ingestTick(); // refresh the brain on load
    const id = window.setInterval(tick, INTERVAL_MS);
    const ingestId = window.setInterval(ingestTick, INGEST_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
      window.clearInterval(ingestId);
    };
  }, []);

  return null;
}
