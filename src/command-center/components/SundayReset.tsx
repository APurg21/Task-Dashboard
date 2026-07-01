"use client";
import React from "react";
import { Overlay } from "./ImpulseCheck";
import { adapters } from "../lib/adapters";

export interface WeekPlan { bigRock: string; workBlocks: string[]; body: string; money: string; social: string; }

const LBL: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", color: "var(--uv)",
  textTransform: "uppercase", display: "block", margin: "11px 0 4px",
};

export function SundayReset({ onClose, plan }: { onClose: () => void; plan: WeekPlan }) {
  async function drop() {
    for (const b of plan.workBlocks) {
      try { await adapters.calendar.block(b, "", ""); } catch { /* best-effort */ }
    }
    onClose();
  }

  return (
    <Overlay onClose={onClose} title="Sunday Reset" accent="var(--uv)"
      icon={<path d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5" />}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--faint)", marginBottom: 12 }}>
        Auto-planned from goals, calendar, pipeline + last week
      </div>

      <div style={{
        margin: 0, padding: 14, borderRadius: 13, border: "1px solid var(--edge)",
        background: "rgba(10,4,24,.5)", fontSize: 12.5, lineHeight: 1.6, color: "var(--dim)",
      }}>
        <span style={{ ...LBL, marginTop: 0 }}>Big rock</span>
        {plan.bigRock}
        <span style={LBL}>Work — focus blocks</span>
        {plan.workBlocks.join(" · ")}
        <span style={LBL}>Body</span>
        {plan.body}
        <span style={LBL}>Money</span>
        {plan.money}
        <span style={LBL}>Life + social</span>
        {plan.social}
      </div>

      <button onClick={drop} className="w-full rounded-xl" style={{
        marginTop: 12, padding: 12, border: 0, fontFamily: "var(--font-display)", fontWeight: 700,
        letterSpacing: ".04em", fontSize: 13, color: "#fff",
        background: "linear-gradient(160deg,var(--violet),#5b54c9)", boxShadow: "var(--g-vi)",
      }}>Drop it all on my calendar</button>
    </Overlay>
  );
}
