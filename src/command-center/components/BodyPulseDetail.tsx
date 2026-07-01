"use client";
import React, { useState, useEffect } from "react";
import { Panel } from "./ui";
import { adapters } from "../lib/adapters";

export interface BodyPulse {
  color: "green" | "yellow" | "red";
  training: { done: number; target: number; nextLabel?: string };
  sleepHrs: number;
  steps: number;
  foodLabel: string;
  note?: string;
}

export function BodyPulseDetail({ data }: { data: BodyPulse }) {
  const [pulse, setPulse] = useState<BodyPulse>(data);
  useEffect(() => {
    adapters.health.getPulse().then(setPulse).catch(() => {});
  }, []);

  const tiles: { title: string; color: string; value: string; sub: string }[] = [
    {
      title: "Training",
      color: "var(--uv)",
      value: `${pulse.training.done} / ${pulse.training.target}`,
      sub: pulse.training.nextLabel ?? "",
    },
    { title: "Sleep", color: "var(--cyan)", value: `${pulse.sleepHrs}h`, sub: "avg · aim 8" },
    { title: "Food", color: "var(--amber)", value: pulse.foodLabel, sub: "protein 82%" },
    { title: "Steps", color: "var(--magenta)", value: `${(pulse.steps / 1000).toFixed(1)}k`, sub: "daily avg" },
  ];

  return (
    <Panel accent="uv" title="Body Pulse" right={<span style={{ color: "var(--uv)" }}>● Strong</span>}>
      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr 1fr", padding: "13px 12px", gap: 11 }}
      >
        {tiles.map((t, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              borderRadius: 16,
              border: "1px solid var(--edge)",
              background: "linear-gradient(160deg,rgba(20,10,42,.6),rgba(10,4,24,.4))",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: t.color,
              }}
            >
              {t.title}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, marginTop: 9 }}>
              {t.value}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 5 }}>
              {t.sub}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
