"use client";
import React from "react";
import { Overlay } from "./ImpulseCheck";

export interface Task { id: string; title: string; sub?: string; priority: "high" | "med" | "low"; done?: boolean; due?: string; source?: string; }
export interface VoiceCapture {
  id: string; transcript: string; durationSec: number; receivedAt: number;
  parsed: { tasks: Task[]; crmNotes: { contact: string; note: string }[]; calendarBlocks: { title: string; start: string; end: string }[] };
}

const DEFAULT_CAPTURE: VoiceCapture = {
  id: "vc-default",
  transcript: "Remind me to call the Richmond Chamber and update the Whitecaps report.",
  durationSec: 6,
  receivedAt: Date.now(),
  parsed: {
    tasks: [
      { id: "vt1", title: "Call Richmond Chamber — sponsorship follow-up", priority: "high" },
      { id: "vt2", title: "Update the Whitecaps report", priority: "med" },
    ],
    crmNotes: [{ contact: "Richmond Chamber (Dana)", note: "Logged follow-up in Pipedrive" }],
    calendarBlocks: [{ title: "Chamber + Whitecaps", start: "Today 2:30p", end: "3:00p" }],
  },
};

const LABEL: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", color: "var(--uv)", marginBottom: 6 };
const PK: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", color: "var(--uv)", textTransform: "uppercase" };

export function VoiceToTask({ onClose, capture }: { onClose: () => void; capture?: VoiceCapture }) {
  const cap = capture ?? DEFAULT_CAPTURE;
  const { tasks, crmNotes, calendarBlocks } = cap.parsed;
  const total = tasks.length + calendarBlocks.length + crmNotes.length;

  return (
    <Overlay onClose={onClose} title="Voice → Task" accent="var(--magenta)"
      icon={<><path d="M9 3h6v11a3 3 0 0 1-6 0z" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></>}>
      <div className="flex items-center" style={{
        gap: 11, padding: 12, borderRadius: 12, border: "1px solid var(--edge)",
        background: "rgba(10,4,24,.5)", marginBottom: 14,
      }}>
        <div className="flex items-end" style={{ gap: 3, height: 20 }}>
          {[10, 18, 7, 16, 12, 20].map((h, i) => (
            <span key={i} style={{ width: 3, height: h, background: "var(--magenta)", borderRadius: 1 }} />
          ))}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)" }}>
          voice note · 0:0{cap.durationSec}
        </span>
      </div>

      <div style={LABEL}>TRANSCRIPT</div>
      <p style={{ fontStyle: "italic", fontSize: 13.5, color: "var(--text)", marginBottom: 16 }}>{cap.transcript}</p>

      <div style={LABEL}>PARSED INTO →</div>

      {tasks.map(t => (
        <div key={t.id} style={{ border: "1px solid var(--edge)", borderRadius: 11, padding: "11px 13px", marginBottom: 9, background: "rgba(10,4,24,.4)" }}>
          <div style={PK}>✓ Task</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{t.title}</div>
        </div>
      ))}
      {calendarBlocks.map((b, i) => (
        <div key={`cal-${i}`} style={{ border: "1px solid var(--edge)", borderRadius: 11, padding: "11px 13px", marginBottom: 9, background: "rgba(10,4,24,.4)" }}>
          <div style={PK}>◷ Calendar block</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{b.start}–{b.end} · &quot;{b.title}&quot;</div>
        </div>
      ))}
      {crmNotes.map((n, i) => (
        <div key={`crm-${i}`} style={{ border: "1px solid var(--edge)", borderRadius: 11, padding: "11px 13px", marginBottom: 9, background: "rgba(10,4,24,.4)" }}>
          <div style={PK}>◈ CRM note</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Logged to {n.contact}</div>
        </div>
      ))}

      <button onClick={onClose} className="w-full rounded-xl" style={{
        marginTop: 12, padding: 12, border: 0, fontFamily: "var(--font-display)", fontWeight: 700,
        letterSpacing: ".04em", fontSize: 13, color: "#fff",
        background: "linear-gradient(160deg,var(--violet),#5b54c9)", boxShadow: "var(--g-vi)",
      }}>Confirm all {total}</button>
    </Overlay>
  );
}
