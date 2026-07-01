"use client";
import React, { useState } from "react";
import { Overlay } from "./ImpulseCheck";

// Voice → Task. Dictate (phone keyboard mic) or type a brain-dump; it's
// classified (title / personal-work / priority) and lands on your real board.
// If no onCapture is wired it falls back to a static demo.

const LABEL: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", color: "var(--uv)", marginBottom: 6 };
const PK: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", color: "var(--uv)", textTransform: "uppercase" };
const BTN: React.CSSProperties = {
  width: "100%", marginTop: 12, padding: 12, border: 0, fontFamily: "var(--font-display)", fontWeight: 700,
  letterSpacing: ".04em", fontSize: 13, color: "#fff",
  background: "linear-gradient(160deg,var(--violet),#5b54c9)", boxShadow: "var(--g-vi)", cursor: "pointer",
};

export function VoiceToTask({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture?: (text: string) => Promise<{ title: string; context: string; priority: string }>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ title: string; context: string; priority: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (onCapture) {
        const res = await onCapture(t);
        setCreated(res);
      } else {
        setCreated({ title: t.slice(0, 80), context: "personal", priority: "medium" });
      }
    } catch {
      setError("Couldn't add that — try again.");
    } finally {
      setBusy(false);
    }
  }

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
          dictate with your keyboard mic, or type
        </span>
      </div>

      {!created ? (
        <>
          <div style={LABEL}>WHAT&apos;S ON YOUR MIND?</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Call the Chamber back about the sponsor night, and I need to hit the gym"
            rows={4}
            autoFocus
            style={{
              width: "100%", resize: "vertical", background: "rgba(10,4,24,.6)", border: "1px solid var(--edge)",
              borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.5,
            }}
          />
          {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{error}</p>}
          <button onClick={add} disabled={!text.trim() || busy} style={{ ...BTN, opacity: !text.trim() || busy ? 0.6 : 1 }}>
            {busy ? "Adding…" : "Add to board"}
          </button>
        </>
      ) : (
        <>
          <div style={LABEL}>ADDED TO YOUR BOARD →</div>
          <div style={{ border: "1px solid rgba(75,227,140,.4)", borderRadius: 11, padding: "12px 13px", marginBottom: 9, background: "rgba(75,227,140,.08)" }}>
            <div style={PK}>✓ Task</div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>{created.title}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 5 }}>
              {created.context} · {created.priority} priority
            </div>
          </div>
          <button onClick={() => { setCreated(null); setText(""); }} style={{
            width: "100%", marginTop: 4, padding: 10, borderRadius: 10, background: "transparent",
            border: "1px solid var(--edge)", color: "var(--dim)", fontSize: 12.5, cursor: "pointer",
          }}>Add another</button>
          <button onClick={onClose} style={BTN}>Done</button>
        </>
      )}
    </Overlay>
  );
}
