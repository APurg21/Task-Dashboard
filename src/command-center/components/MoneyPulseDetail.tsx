"use client";
import React, { useState, useEffect } from "react";
import { Panel, StatusLight } from "./ui";
import { adapters } from "../lib/adapters";

export interface MoneyPulse {
  color: "green" | "yellow" | "red";
  spent: number;
  budget: number;
  daysLeft: number;
  categories: { label: string; amount: number }[];
  note?: string;
}

export function MoneyPulseDetail({ data }: { data: MoneyPulse }) {
  const [pulse, setPulse] = useState<MoneyPulse>(data);
  useEffect(() => {
    adapters.money.getPulse().then(setPulse).catch(() => {});
  }, []);

  const pct = Math.round((pulse.spent / pulse.budget) * 100);
  const colorWord = pulse.color.charAt(0).toUpperCase() + pulse.color.slice(1);

  return (
    <Panel
      accent="amber"
      title="Money Pulse"
      right={
        <span className="flex items-center gap-2" style={{ color: "var(--amber)" }}>
          <StatusLight color={pulse.color} />
          {`${colorWord} · watch it`}
        </span>
      }
    >
      <div style={{ padding: "8px 10px 12px" }}>
        <div className="flex" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)" }}>SPENT THIS WEEK</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: "var(--amber)" }}>
              ${pulse.spent.toLocaleString()}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)" }}>PACE / BUDGET</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24 }}>
              ${pulse.budget.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ height: 5, borderRadius: 5, background: "rgba(255,255,255,.08)", overflow: "hidden", marginTop: 10 }}>
          <i
            style={{
              display: "block",
              height: "100%",
              width: `${pct}%`,
              background: "var(--amber)",
              boxShadow: "0 0 10px var(--amber)",
            }}
          />
        </div>

        <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 10 }}>
          You're at <b style={{ color: "var(--amber)" }}>{pct}%</b> of the weekly budget with {pulse.daysLeft} days left.
          {pulse.note ? " " + pulse.note : ""}
        </div>

        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            color: "var(--faint)",
            margin: "12px 12px 6px",
          }}
        >
          By category
        </div>

        <div
          className="flex flex-wrap"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)", padding: "2px 12px", justifyContent: "space-between" }}
        >
          {pulse.categories.map((c, i) => (
            <span key={i}>{`${c.label} $${c.amount.toLocaleString()}`}</span>
          ))}
        </div>
      </div>
    </Panel>
  );
}
