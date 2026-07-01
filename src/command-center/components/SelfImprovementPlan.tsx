"use client";
import React from "react";
import { Panel } from "./ui";

export interface ImprovementMove {
  axis: "career" | "body" | "money" | "social";
  move: string;
  progress?: string;
}

const axisStyle: Record<ImprovementMove["axis"], { bg: string; color: string }> = {
  career: { bg: "rgba(157,92,255,.16)", color: "var(--violet)" },
  body: { bg: "rgba(182,255,60,.14)", color: "var(--uv)" },
  money: { bg: "rgba(53,231,255,.14)", color: "var(--cyan)" },
  social: { bg: "rgba(255,61,190,.14)", color: "var(--magenta)" },
};

const axisGlyph: Record<ImprovementMove["axis"], React.ReactNode> = {
  career: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  body: <path d="M12 3v4m0 0-4 5h8l-4-5Zm0 9v9m-5 0h10" />,
  money: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5a2.5 2.5 0 0 1 5 0M9 14.5a2.5 2.5 0 0 0 5 0" /></>,
  social: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0" /></>,
};

export function SelfImprovementPlan({ moves }: { moves: ImprovementMove[] }) {
  return (
    <Panel accent="uv" title="Self-Improvement Plan" right="one move each">
      <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "8px 10px 12px" }}>
        {moves.map((m, i) => {
          const s = axisStyle[m.axis];
          return (
            <div
              key={i}
              className="move"
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                borderRadius: 13,
                border: "1px solid var(--edge)",
                background: "rgba(10,4,24,.4)",
              }}
            >
              <span
                className="grid place-items-center"
                style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, color: s.color, flexShrink: 0 }}
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  {axisGlyph[m.axis]}
                </svg>
              </span>
              <div style={{ flex: 1 }}>
                <h4
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 11,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: s.color,
                    margin: 0,
                  }}
                >
                  {m.axis.charAt(0).toUpperCase() + m.axis.slice(1)}
                </h4>
                <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--text)" }}>{m.move}</p>
                {m.progress && (
                  <div className="p" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 5 }}>
                    {m.progress}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
