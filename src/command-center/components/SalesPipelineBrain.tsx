"use client";
import React, { useEffect, useState } from "react";
import { Panel } from "./ui";
import { adapters } from "../lib/adapters";
import type { Deal, PipelineSummary } from "../lib/types";

const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;

const pillStyle: Record<string, React.CSSProperties> = {
  hot: { background: "rgba(255,61,190,.14)", color: "var(--magenta)", border: "1px solid rgba(255,61,190,.35)" },
  warm: { background: "rgba(255,194,77,.14)", color: "var(--amber)", border: "1px solid rgba(255,194,77,.35)" },
  stalled: { background: "rgba(255,92,108,.14)", color: "var(--red)", border: "1px solid rgba(255,92,108,.35)" },
};

function HeatPill({ deal }: { deal: Deal }) {
  const kind = deal.heat === "hot" ? "hot" : deal.heat === "stalled" ? "stalled" : "warm";
  const label = deal.heat === "stalled" ? `STALLED ${deal.ageDays}d` : deal.heat.toUpperCase();
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
      padding: "3px 7px", borderRadius: 6, whiteSpace: "nowrap", ...pillStyle[kind],
    }}>{label}</span>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const stageLine =
    `${deal.stage} · ${Math.round(deal.probability * 100)}%` +
    (deal.closeEta ? " · close ~" + deal.closeEta : deal.ageDays ? " · aging " + deal.ageDays + "d" : "");
  return (
    <div className="flex" style={{
      gap: 12, padding: 12, borderRadius: 13, border: "1px solid var(--edge)",
      background: "rgba(10,4,24,.4)", margin: "0 12px 10px",
    }}>
      <div style={{
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16,
        color: "var(--uv)", textShadow: "var(--g-uv)", flex: "0 0 76px",
      }}>{fmtK(deal.amount)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, fontWeight: 500 }}>{deal.name}</span>
          <HeatPill deal={deal} />
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{stageLine}</div>
        {deal.sayNext && (
          <div style={{
            fontSize: 11, color: "var(--cyan)", marginTop: 6, padding: "6px 9px",
            borderRadius: 8, background: "rgba(53,231,255,.08)", border: "1px solid rgba(53,231,255,.2)",
          }}>
            <b style={{ color: "var(--cyan)" }}>Say next:</b> {deal.sayNext}
          </div>
        )}
      </div>
    </div>
  );
}

const subHeader: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9.5, textTransform: "uppercase",
  letterSpacing: ".12em", color: "var(--faint)", margin: "12px 12px 6px",
};

export function SalesPipelineBrain({ data }: { data: PipelineSummary }) {
  const [summary, setSummary] = useState<PipelineSummary>(data);
  useEffect(() => { adapters.pipedrive.getPipeline().then(setSummary).catch(() => {}); }, []);

  const stat = (label: string, value: string, color: string, glow?: string) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", color: "var(--faint)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color, textShadow: glow }}>{value}</div>
    </div>
  );

  return (
    <Panel accent="uv" title="Sales Pipeline Brain" right="Pipedrive · Sheets · Gmail">
      <div className="flex" style={{ gap: 12, padding: "12px 12px 4px" }}>
        {stat("PROJECTED · Q3", fmtK(summary.projected), "var(--uv)", "var(--g-uv)")}
        {stat("WEIGHTED", fmtK(summary.weighted), "var(--cyan)")}
        {stat("STALLED", String(summary.stalledCount), "var(--red)")}
      </div>

      <div style={subHeader}>Best opportunities</div>
      {summary.best.map(d => <DealCard key={d.id} deal={d} />)}

      <div style={subHeader}>Stalled — needs a nudge</div>
      {summary.stalled.map(d => <DealCard key={d.id} deal={d} />)}
    </Panel>
  );
}
