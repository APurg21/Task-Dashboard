"use client";
import React, { useState } from "react";
import type { ImpulseQuestion, ImpulseVerdict } from "../lib/types";

const QUESTIONS: ImpulseQuestion[] = [
  { q: "How much?", options: [{ label: "Under $50", weight: 0 }, { label: "$50–200", weight: 1 }, { label: "$200+", weight: 2 }] },
  { q: "Did you plan this?", options: [{ label: "Yes, budgeted", weight: 0 }, { label: "No, saw it now", weight: 2 }] },
  { q: "Will it matter in a week?", options: [{ label: "Yes", weight: 0 }, { label: "Probably not", weight: 2 }] },
];

/** Pass moneyPulseColor so a yellow/red pulse tightens the verdict. */
export function ImpulseCheck({ onClose, moneyPulseColor = "green" }: { onClose: () => void; moneyPulseColor?: "green" | "yellow" | "red" }) {
  const [picks, setPicks] = useState<(number | null)[]>([null, null, null]);
  const [verdict, setVerdict] = useState<ImpulseVerdict | null>(null);

  function decide() {
    const score = picks.reduce((s: number, w) => s + (w ?? 0), 0) + (moneyPulseColor === "red" ? 2 : moneyPulseColor === "yellow" ? 1 : 0);
    const go = score <= 2;
    setVerdict({
      go,
      reason: go
        ? "Planned and it holds up. Enjoy it — your Money Pulse can take it."
        : "Unplanned + won't matter in a week, and your Money Pulse is already tight. Sleep on it; if you still want it tomorrow, it's yours.",
    });
  }

  return (
    <Overlay onClose={onClose} title="Impulse Check" accent="var(--cyan)"
      icon={<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />}>
      {!verdict ? (
        <>
          <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>About to spend? Answer 3 fast questions.</p>
          {QUESTIONS.map((step, qi) => (
            <div key={qi} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, display: "block", marginBottom: 8 }}>{qi + 1} · {step.q}</label>
              <div className="flex flex-wrap gap-2">
                {step.options.map((o, oi) => {
                  const sel = picks[qi] === o.weight;
                  return (
                    <button key={oi} onClick={() => setPicks(p => p.map((v, i) => i === qi ? o.weight : v))}
                      className="rounded-[10px]" style={{
                        fontSize: 12, padding: "9px 13px", background: "rgba(10,4,24,.5)",
                        border: `1px solid ${sel ? "var(--uv)" : "var(--edge)"}`, color: sel ? "var(--uv)" : "var(--dim)",
                        boxShadow: sel ? "var(--g-uv)" : "none",
                      }}>{o.label}</button>
                  );
                })}
              </div>
            </div>
          ))}
          <MBtn onClick={decide}>Get the verdict</MBtn>
        </>
      ) : (
        <>
          <div className="rounded-2xl text-center" style={{
            padding: 18, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: ".04em",
            color: verdict.go ? "var(--green)" : "var(--red)",
            background: verdict.go ? "rgba(75,227,140,.12)" : "rgba(255,92,108,.12)",
            border: `1px solid ${verdict.go ? "rgba(75,227,140,.4)" : "rgba(255,92,108,.4)"}`,
          }}>{verdict.go ? "✓  GO AHEAD" : "✕  SLEEP ON IT"}</div>
          <p className="text-center" style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14 }}>{verdict.reason}</p>
          <MBtn onClick={onClose}>Got it</MBtn>
        </>
      )}
    </Overlay>
  );
}

/* --- tiny local modal shell (reuse across Voice / Missing / Sunday) --- */
export function Overlay({ onClose, title, icon, accent, children }: {
  onClose: () => void; title: string; icon: React.ReactNode; accent: string; children: React.ReactNode;
}) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{ background: "rgba(4,1,9,.72)", backdropFilter: "blur(6px)", padding: "8vh 16px 16px" }}>
      <div className="overflow-hidden rounded-[20px]" style={{
        width: "min(560px,96vw)", border: "1px solid var(--edge-hot)",
        background: "linear-gradient(160deg,rgba(28,14,58,.96),rgba(12,6,30,.96))",
        boxShadow: "0 40px 90px -30px #000, var(--g-vi)",
      }}>
        <header className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--edge)" }}>
          <span className="grid place-items-center rounded-[10px]" style={{ width: 34, height: 34, background: "rgba(53,231,255,.14)", color: accent }}>
            <svg width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{icon}</svg>
          </span>
          <h3 className="m-0" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: ".03em" }}>{title}</h3>
          <button onClick={onClose} className="ml-auto" style={{ background: "none", border: 0, color: "var(--faint)", fontSize: 22, lineHeight: 1 }}>×</button>
        </header>
        <div className="overflow-auto" style={{ padding: "16px 18px 20px", maxHeight: "64vh" }}>{children}</div>
      </div>
    </div>
  );
}
function MBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="w-full rounded-xl" style={{
    marginTop: 12, padding: 12, border: 0, fontFamily: "var(--font-display)", fontWeight: 700,
    letterSpacing: ".04em", fontSize: 13, color: "#fff",
    background: "linear-gradient(160deg,var(--violet),#5b54c9)", boxShadow: "var(--g-vi)",
  }}>{children}</button>;
}
