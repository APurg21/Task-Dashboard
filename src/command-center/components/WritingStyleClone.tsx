"use client";
import React from "react";
import { Panel } from "./ui";
import type { Draft, StyleProfile } from "../lib/types";

const genBlock: React.CSSProperties = {
  margin: "0 14px 12px", padding: 14, borderRadius: 13,
  border: "1px solid var(--edge)", background: "rgba(10,4,24,.5)",
  fontSize: 12.5, lineHeight: 1.6, color: "var(--dim)",
};

const defaultDraft: Draft = {
  to: "Dana (Richmond Chamber)",
  body: `"Hey Dana — good running into you at the mixer. That glow-night sponsor slot I mentioned is the one that books fast every season. Got 15 min this week to walk the tiers? I'll bring the numbers."`,
  matched: ["your greeting", "short sentences", '"the one that books fast"'],
};

export function WritingStyleClone({ initial, style }: { initial?: Draft; style?: StyleProfile }) {
  const draft = initial ?? defaultDraft;
  void style;
  return (
    <Panel accent="violet" title="Your Voice — Draft" right="sounds like you">
      <div style={genBlock}>
        <span style={{
          display: "block", fontFamily: "var(--font-mono)", fontSize: 9.5,
          letterSpacing: ".1em", color: "var(--uv)",
        }}>To: {draft.to}</span>
        <div style={{ marginTop: 6 }}>{draft.body}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 8 }}>
          ✓ matched {draft.matched.join(" · ")}
        </div>
      </div>
    </Panel>
  );
}
