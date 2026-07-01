"use client";
import React from "react";
import type { Accent, Priority, PulseColor } from "../lib/types";

const accentVar: Record<Accent, string> = {
  uv: "var(--uv)", cyan: "var(--cyan)", violet: "var(--violet)",
  magenta: "var(--magenta)", amber: "var(--amber)",
};

/** Glass panel with a glowing left accent spine. */
export function Panel({ accent = "violet", title, right, children, className = "" }: {
  accent?: Accent; title?: string; right?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[18px] ${className}`}
      style={{
        border: "1px solid var(--edge)", background: "var(--glass)",
        backdropFilter: "blur(14px)",
        boxShadow: `inset 3px 0 0 ${accentVar[accent]}, 0 16px 46px -34px #000`,
      }}
    >
      {title && (
        <header className="flex items-center gap-2 px-4 pt-3 pb-2"
          style={{ borderBottom: "1px solid rgba(157,92,255,.13)" }}>
          <h2 className="m-0 uppercase" style={{
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12.5,
            letterSpacing: ".11em", color: "var(--text)",
          }}>{title}</h2>
          {right && <span className="ml-auto"
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>{right}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

const tagStyle: Record<string, React.CSSProperties> = {
  high: { color: "var(--amber)", borderColor: "rgba(255,194,77,.45)", background: "rgba(255,194,77,.12)" },
  med:  { color: "var(--cyan)",  borderColor: "rgba(53,231,255,.40)", background: "rgba(53,231,255,.10)" },
  low:  { color: "var(--faint)", borderColor: "var(--edge)", background: "transparent" },
  life: { color: "var(--uv)",    borderColor: "rgba(182,255,60,.35)", background: "rgba(182,255,60,.08)" },
};
export function Tag({ kind = "med", children }: { kind?: Priority | "life"; children: React.ReactNode }) {
  return (
    <span className="rounded-md border" style={{
      fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".07em",
      padding: "3px 7px", whiteSpace: "nowrap", ...tagStyle[kind],
    }}>{children}</span>
  );
}

const lightVar: Record<PulseColor, string> = { green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)" };
export function StatusLight({ color }: { color: PulseColor }) {
  return <span className="inline-block rounded-full" style={{
    width: 11, height: 11, background: lightVar[color], boxShadow: `0 0 10px ${lightVar[color]}`,
  }} />;
}

export const glow: Record<Accent, string> = {
  uv: "var(--g-uv)", cyan: "var(--g-cy)", magenta: "var(--g-mg)", violet: "var(--g-vi)", amber: "var(--g-uv)",
};
export { accentVar };
