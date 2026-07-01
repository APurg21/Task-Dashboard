"use client";
import React, { useState } from "react";
import { Panel, Tag } from "./ui";
import { PulseStrip } from "./PulseStrip";
import { ChiefOfStaffChat } from "./ChiefOfStaffChat";
import type { DailyCommand, Task, LifePriority } from "../lib/types";

function TaskRow({ t }: { t: Task }) {
  const [done, setDone] = useState(!!t.done);
  return (
    <div className="flex items-start gap-2.5 rounded-xl" style={{ padding: "10px 11px" }}>
      <span onClick={() => setDone(d => !d)} className="mt-px cursor-pointer rounded-md" style={{
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
function LifeRow({ p }: { p: LifePriority }) {
  const [done, setDone] = useState(!!p.done);
  return (
    <div className="flex items-start gap-2.5 rounded-xl" style={{ padding: "10px 11px" }}>
      <span onClick={() => setDone(d => !d)} className="mt-px cursor-pointer rounded-md" style={{
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

export function DailyCommandCenter({ data }: { data: DailyCommand }) {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Panel accent="uv" title="Top 3 · Work" right="move the needle">
            <div style={{ padding: "8px 10px 12px" }}>{data.topTasks.map(t => <TaskRow key={t.id} t={t} />)}</div>
          </Panel>
          <Panel accent="magenta" title="Today · Life" right="3 off-clock">
            <div style={{ padding: "8px 10px 12px" }}>{data.lifePriorities.map(p => <LifeRow key={p.id} p={p} />)}</div>
          </Panel>
        </div>

        <PulseStrip money={data.pulses.money} body={data.pulses.body} clean={data.pulses.clean} />

        <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Panel accent="cyan" title="Today's Meetings" right={`${data.meetings.length}`}>
            <div style={{ padding: "8px 6px 12px" }}>
              {data.meetings.map(m => (
                <div key={m.id} className="flex gap-3 rounded-xl" style={{ padding: "9px 11px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cyan)", width: 52, flex: "0 0 52px" }}>{m.time}</span>
                  <div><div style={{ fontSize: 12.5 }}>{m.title}</div>{m.where && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 2 }}>{m.where}</div>}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel accent="amber" title="Emails That Matter" right={`${data.emails.length}`}>
            <div style={{ padding: "8px 10px 12px" }}>
              {data.emails.map(e => (
                <div key={e.id} className="flex items-start gap-2.5 rounded-xl" style={{ padding: "10px 11px" }}>
                  <div className="flex-1">
                    <div style={{ fontSize: 13 }}>{e.subject}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{e.from} · {e.ageDays}d</div>
                  </div>
                  <Tag kind={e.action === "reply" ? "high" : "med"}>{e.action.toUpperCase()}</Tag>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <ChiefOfStaffChat ctx={data} />
    </div>
  );
}
