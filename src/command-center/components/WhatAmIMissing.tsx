"use client";
import React from "react";
import { Overlay } from "./ImpulseCheck";

export type BlindSpotSeverity = "critical" | "warn" | "good";
export interface BlindSpot {
  id: string; severity: BlindSpotSeverity; title: string; detail?: string;
  fix?: { label: string; kind: string };
}

const DEFAULT_SPOTS: BlindSpot[] = [
  { id: "b1", severity: "critical", title: "3 high-value leads with no next step", detail: "Lehigh Valley ($28K), Chamber ($14K), Markel outing — none have a scheduled touch" },
  { id: "b2", severity: "warn", title: "Werner Park deal stalled 11 days", detail: "Past your 7-day rule — auto-draft a 'hold your date' nudge?" },
  { id: "b3", severity: "warn", title: "Money Pulse trending red", detail: "84% of weekly budget spent, 4 days left — one big buy tips it" },
  { id: "b4", severity: "good", title: "Nice: gym + sleep both on track this week" },
];

export function WhatAmIMissing({ onClose, spots }: { onClose: () => void; spots?: BlindSpot[] }) {
  const items = spots ?? DEFAULT_SPOTS;

  return (
    <Overlay onClose={onClose} title="What Am I Missing?" accent="var(--amber)"
      icon={<path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--faint)", marginBottom: 14 }}>
        Scanned tasks · emails · calendar · CRM · notes
      </div>

      {items.map(s => {
        const good = s.severity === "good";
        return (
          <div key={s.id} className="flex" style={{
            gap: 11, padding: 12, borderRadius: 12, marginBottom: 9,
            border: good ? "1px solid rgba(53,231,255,.3)" : "1px solid rgba(255,92,108,.3)",
            background: good ? "rgba(53,231,255,.06)" : "rgba(255,92,108,.06)",
          }}>
            <span style={{ color: good ? "var(--cyan)" : "var(--red)", flexShrink: 0 }}>
              <svg width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                {good
                  ? <path d="M20 6 9 17l-5-5" />
                  : <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>}
              </svg>
            </span>
            <div>
              <div style={{ fontSize: 12.5 }}><strong>{s.title}</strong></div>
              {s.detail && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{s.detail}</div>}
            </div>
          </div>
        );
      })}

      <button onClick={onClose} className="w-full rounded-xl" style={{
        marginTop: 12, padding: 12, border: 0, fontFamily: "var(--font-display)", fontWeight: 700,
        letterSpacing: ".04em", fontSize: 13, color: "#fff",
        background: "linear-gradient(160deg,var(--violet),#5b54c9)", boxShadow: "var(--g-vi)",
      }}>Fix the top 3 for me</button>
    </Overlay>
  );
}
