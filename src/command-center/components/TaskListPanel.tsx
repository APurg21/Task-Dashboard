"use client";
import React from "react";
import { Panel, Tag } from "./ui";
import { TaskRow } from "./DailyCommandCenter";
import type { Accent, Task as CCTask } from "../lib/types";

// Full open-task list for the Work / Life tabs. Same row component, same
// check-off pipe as Top-3 — this is the "see and repair everything" view,
// fed by LiveCommandCenter from the same /api/tasks source of truth.

export interface ListTask extends CCTask {
  overdue?: boolean;
}

export function TaskListPanel({ title, accent, tasks, onToggle }: {
  title: string;
  accent: Accent;
  tasks: ListTask[];
  onToggle?: (id: string, done: boolean) => void;
}) {
  return (
    <Panel accent={accent} title={title} right={`${tasks.length} open`}>
      <div style={{ padding: "8px 10px 12px" }}>
        {tasks.length === 0 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", padding: "14px 11px" }}>
            Nothing open — text the bot and it lands here.
          </div>
        )}
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            t={t}
            onToggle={onToggle}
            flag={t.overdue ? <Tag kind="high">OVERDUE</Tag> : undefined}
          />
        ))}
      </div>
    </Panel>
  );
}
