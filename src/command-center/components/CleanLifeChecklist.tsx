"use client";
import React, { useState } from "react";
import { Panel } from "./ui";

export interface CleanItem {
  id: string;
  label: string;
  done: boolean;
  meta?: string;
}

export interface CleanLifeScore {
  score: number;
  outOf: number;
  items: CleanItem[];
}

export function CleanLifeChecklist({ data }: { data: CleanLifeScore }) {
  const [done, setDone] = useState<Record<string, boolean>>(
    () => Object.fromEntries(data.items.map((it) => [it.id, it.done]))
  );

  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <Panel accent="cyan" title="Clean Life Score" right={<span style={{ color: "var(--cyan)" }}>{`${data.score} / ${data.outOf}`}</span>}>
      <div style={{ padding: "8px 10px 12px" }}>
        {data.items.map((it) => {
          const isDone = done[it.id];
          return (
            <div
              key={it.id}
              className="clean flex items-center"
              style={{ gap: 11, padding: "9px 11px", borderRadius: 11 }}
            >
              <span
                className="cc"
                onClick={() => toggle(it.id)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  border: "1.7px solid var(--faint)",
                  cursor: "pointer",
                  flexShrink: 0,
                  ...(isDone
                    ? { background: "var(--uv)", borderColor: "var(--uv)", boxShadow: "var(--g-uv)" }
                    : {}),
                }}
              />
              <span
                className="cn flex-1"
                style={{ fontSize: 12.5, ...(isDone ? { color: "var(--faint)" } : {}) }}
              >
                {it.label}
              </span>
              {it.meta && (
                <span className="cd" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>
                  {it.meta}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
