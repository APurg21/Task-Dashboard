"use client";
import React, { useState } from "react";
import { Panel } from "./ui";
import { adapters } from "../lib/adapters";
import type { WeeklyStory } from "../lib/types";

const genBlock: React.CSSProperties = {
  margin: "0 14px 12px", padding: 14, borderRadius: 13,
  border: "1px solid var(--edge)", background: "rgba(10,4,24,.5)",
  fontSize: 12.5, lineHeight: 1.6, color: "var(--dim)",
};

function Lbl({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return (
    <span style={{
      display: "block", fontFamily: "var(--font-mono)", fontSize: 9.5,
      letterSpacing: ".1em", color: "var(--uv)", textTransform: "uppercase",
      margin: first ? "0 0 4px" : "11px 0 4px",
    }}>{children}</span>
  );
}

export function WeeklySalesStory({ story, ctx }: { story?: WeeklyStory; ctx?: unknown }) {
  const [result, setResult] = useState<WeeklyStory | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      setResult(await adapters.ai.weeklyStory(ctx));
    } catch {
      if (story) setResult(story);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel accent="cyan" title="Weekly Sales Story" right={
      <button onClick={generate} style={{
        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--uv)",
        border: "1px solid rgba(182,255,60,.35)", borderRadius: 6,
        padding: "3px 8px", background: "transparent", cursor: "pointer",
      }}>{busy ? "generating…" : "Generate ▸"}</button>
    }>
      {result && (
        <div style={genBlock}>
          <Lbl first>What happened</Lbl>
          {result.whatHappened}
          <Lbl>Why</Lbl>
          {result.why}
          <Lbl>What&apos;s next</Lbl>
          {result.whatsNext}
        </div>
      )}
    </Panel>
  );
}
