"use client";
import React, { useState } from "react";
import { Panel, Tag } from "./ui";
import { ChiefOfStaffChat } from "./ChiefOfStaffChat";
import type { DailyCommand, Task, LifePriority } from "../lib/types";

function TaskRow({ t, onToggle }: { t: Task; onToggle?: (id: string, done: boolean) => void }) {
  const [done, setDone] = useState(!!t.done);
  const toggle = () => setDone(d => { const nd = !d; onToggle?.(t.id, nd); return nd; });
  return (
    <div className="flex items-start gap-2.5 rounded-xl" style={{ padding: "10px 11px" }}>
      <span onClick={toggle} className="mt-px cursor-pointer rounded-md" style={{
        width: 18, height: 18, flex: "0 0 18px",
        border: `1.7px solid ${done ? "var(--uv)" : "var(--faint)"}`,
        background: done ? "var(--uv)" : "transparent", boxShadow: done ? "var(--g-uv)" : "none",
      }} />
      <div className="flex-1">
        <div style={{ fontSize: 13, lineHeight: 1.35, color: done ? "var(--faint)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>{t.title}</div>
        {t.sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{t.sub}</div>}
      </div>
      <Tag kind={t.priority}>{t.priority.toUpperCase()}</Tag>
    </div>
  );
}
function LifeRow({ p, onToggle }: { p: LifePriority; onToggle?: (id: string, done: boolean) => void }) {
  const [done, setDone] = useState(!!p.done);
  const toggle = () => setDone(d => { const nd = !d; onToggle?.(p.id, nd); return nd; });
  return (
    <div className="flex items-start gap-2.5 rounded-xl" style={{ padding: "10px 11px" }}>
      <span onClick={toggle} className="mt-px cursor-pointer rounded-md" style={{
        width: 18, height: 18, flex: "0 0 18px",
        border: `1.7px solid ${done ? "var(--uv)" : "var(--faint)"}`,
        background: done ? "var(--uv)" : "transparent", boxShadow: done ? "var(--g-uv)" : "none",
      }} />
      <div className="flex-1">
        <div style={{ fontSize: 13, color: done ? "var(--faint)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>{p.title}</div>
        {p.sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{p.sub}</div>}
      </div>
      <Tag kind="life">{p.tag.slice(0, 4).toUpperCase()}</Tag>
    </div>
  );
}

export function DailyCommandCenter({ data, onToggle, onCurate, curating, curateWhy }: {
  data: DailyCommand;
  onToggle?: (id: string, done: boolean) => void;
  onCurate?: () => void;
  curating?: boolean;
  curateWhy?: string;
}) {
  const curateBtn = onCurate ? (
    <button onClick={onCurate} disabled={curating} style={{
      fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--uv)",
      border: "1px solid rgba(182,255,60,.35)", borderRadius: 6, padding: "3px 8px",
      background: "transparent", cursor: curating ? "default" : "pointer", opacity: curating ? 0.6 : 1,
    }}>{curating ? "curating…" : "✦ curate"}</button>
  ) : "move the needle";
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Panel accent="uv" title="Top 3 · Work" right={curateBtn}>
            <div style={{ padding: "8px 10px 12px" }}>
              {data.topTasks.map(t => <TaskRow key={t.id} t={t} onToggle={onToggle} />)}
              {curateWhy && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cyan)", padding: "4px 11px 0", lineHeight: 1.5 }}>
                  ✦ {curateWhy}
                </div>
              )}
            </div>
          </Panel>
          <Panel accent="magenta" title="Today · Life" right="off-clock">
            <div style={{ padding: "8px 10px 12px" }}>{data.lifePriorities.map(p => <LifeRow key={p.id} p={p} onToggle={onToggle} />)}</div>
          </Panel>
        </div>
      </div>

      <ChiefOfStaffChat ctx={data} />
    </div>
  );
}
