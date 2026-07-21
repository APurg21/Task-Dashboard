"use client";
import React, { useState } from "react";
import { Panel } from "./ui";
import { adapters } from "../lib/adapters";
import type { NoteHit } from "../lib/types";

const CHIPS = ["group sales scripts", "best prospecting framework", "50/50 raffle pricing"];

export function ObsidianKnowledge({ initial }: { initial?: NoteHit[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteHit[]>(initial ?? []);
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function syncVault() {
    setSyncing(true);
    setSyncMsg("reading vault…");
    try {
      const res = await fetch("/api/ingest/obsidian", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg(data.error || "sync failed");
        return;
      }
      const fails = data.failures?.length ? `, ${data.failures.length} failed` : "";
      const gone = data.removed ? `, ${data.removed} removed` : "";
      setSyncMsg(
        `${data.ingested} updated, ${data.unchanged} unchanged${gone} → ${data.totalChunks} chunks total${fails}`
      );
    } catch {
      setSyncMsg("couldn't reach the vault — is Obsidian running locally?");
    } finally {
      setSyncing(false);
    }
  }

  async function runSearch(q: string) {
    const term = q.trim();
    if (!term) return;
    setSearching(true);
    try {
      const hits = await adapters.obsidian.search(term);
      setResults(hits);
    } catch {
      setResults(initial ?? []);
    } finally {
      setSearching(false);
    }
  }

  const right = results.length ? `${results.length} results` : "search your notes";

  return (
    <Panel accent="violet" title="Obsidian Knowledge Assistant" right={right}>
      <div className="kbar flex gap-2" style={{ margin: "13px 14px" }}>
        <input
          className="flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch(query);
          }}
          placeholder="Ask your notes… e.g. 'my best prospecting framework'"
          style={{
            background: "rgba(10,4,24,.6)",
            border: "1px solid var(--edge)",
            borderRadius: 12,
            padding: "11px 13px",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
        <button
          onClick={() => runSearch(query)}
          className="grid place-items-center"
          style={{
            width: 40,
            borderRadius: 11,
            border: 0,
            background: "linear-gradient(160deg,var(--violet),#5b54c9)",
            boxShadow: "var(--g-vi)",
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2" style={{ padding: "0 14px 8px" }}>
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setQuery(c);
              runSearch(c);
            }}
            style={{
              fontSize: 11,
              color: "var(--dim)",
              background: "rgba(10,4,24,.6)",
              border: "1px solid var(--edge)",
              borderRadius: 999,
              padding: "6px 11px",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2" style={{ padding: "0 14px 10px" }}>
        <button
          onClick={syncVault}
          disabled={syncing}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--uv)",
            background: "rgba(10,4,24,.6)",
            border: "1px solid var(--edge)",
            borderRadius: 999,
            padding: "6px 12px",
            opacity: syncing ? 0.6 : 1,
            cursor: syncing ? "default" : "pointer",
          }}
        >
          {syncing ? "syncing…" : "⟳ Sync vault → brain"}
        </button>
        {syncMsg && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>
            {syncMsg}
          </span>
        )}
      </div>

      {searching && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", padding: "0 14px 8px" }}>
          searching…
        </div>
      )}

      {results.map((hit) => (
        <div
          key={hit.id}
          className="note-hit"
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--edge)",
            background: "rgba(10,4,24,.4)",
            margin: "0 14px 10px",
          }}
        >
          <div className="nt" style={{ fontFamily: "var(--font-display)", fontSize: 12.5, fontWeight: 600, color: "var(--uv)" }}>
            {hit.title}
          </div>
          <div className="nx" style={{ fontSize: 12, color: "var(--dim)", marginTop: 5, lineHeight: 1.5 }}>
            {hit.excerpt}
          </div>
          <div className="nm" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)", marginTop: 7 }}>
            {hit.path} · edited {hit.editedLabel}
          </div>
        </div>
      ))}
    </Panel>
  );
}
