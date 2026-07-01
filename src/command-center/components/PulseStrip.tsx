"use client";
import React from "react";
import type { MoneyPulse, BodyPulse, CleanLifeScore, PulseColor } from "../lib/types";

const c: Record<PulseColor, string> = { green: "var(--green)", yellow: "var(--amber)", red: "var(--red)" };

function Tile({ light, title, value, sub, pct, accent, footL, footR }: {
  light: PulseColor; title: string; value: string; sub: string; pct: number;
  accent: string; footL?: string; footR?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4"
      style={{ border: "1px solid var(--edge)", background: "linear-gradient(160deg,rgba(20,10,42,.6),rgba(10,4,24,.4))" }}>
      <span className="absolute rounded-full" style={{ top: 14, right: 14, width: 11, height: 11, background: c[light], boxShadow: `0 0 10px ${c[light]}` }} />
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase", color: accent }}>{title}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, marginTop: 9, lineHeight: 1, color: accent }}>{value}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 5 }}>{sub}</div>
      <div className="overflow-hidden rounded" style={{ height: 5, background: "rgba(255,255,255,.08)", marginTop: 10 }}>
        <i style={{ display: "block", height: "100%", width: `${pct}%`, background: accent, boxShadow: `0 0 10px ${accent}` }} />
      </div>
      {(footL || footR) && (
        <div className="flex justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)", marginTop: 8 }}>
          <span>{footL}</span><span>{footR}</span>
        </div>
      )}
    </div>
  );
}

export function PulseStrip({ money, body, clean }: { money: MoneyPulse; body: BodyPulse; clean: CleanLifeScore }) {
  const moneyPct = Math.min(100, Math.round((money.spent / money.budget) * 100));
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
      <Tile light={money.color} accent="var(--amber)" title="Money Pulse"
        value={money.color[0].toUpperCase() + money.color.slice(1)}
        sub={`$${money.spent.toLocaleString()} / $${money.budget.toLocaleString()} pace`} pct={moneyPct}
        footL={`${moneyPct}% of week`} footR={`${money.daysLeft} days left`} />
      <Tile light={body.color} accent="var(--uv)" title="Body Pulse" value="Strong"
        sub={`${body.training.done} lifts · ${body.sleepHrs}h sleep · ${(body.steps / 1000).toFixed(1)}k steps`} pct={78}
        footL={`food ${body.foodLabel}`} footR="hydrate ↑" />
      <Tile light={clean.score >= 8 ? "green" : clean.score >= 5 ? "yellow" : "red"} accent="var(--cyan)"
        title="Clean Life" value={`${clean.score} / ${clean.outOf}`}
        sub={clean.items.filter(i => !i.done).slice(0, 2).map(i => i.label.toLowerCase()).join(" + ") + " due"}
        pct={(clean.score / clean.outOf) * 100} />
    </div>
  );
}
