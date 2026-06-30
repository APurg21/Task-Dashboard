"use client";

import { useMemo } from "react";
import type { Task } from "@/lib/types";

interface Props {
  // Tasks already filtered to the active section (personal/work/all).
  tasks: Task[];
}

interface Metric {
  label: string;
  value: number;
  hint: string;
  accent: string;
}

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

export default function MetricCards({ tasks }: Props) {
  const metrics = useMemo<Metric[]>(() => {
    const todo = tasks.filter((t) => t.status === "todo").length;
    const doing = tasks.filter((t) => t.status === "doing").length;
    const highOpen = tasks.filter(
      (t) => t.status !== "done" && t.priority === "high"
    ).length;
    // createdAt is a high-resolution stamp (ms * 1000); normalize to ms.
    const weekAgoStamp = (Date.now() - ONE_WEEK) * 1000;
    const doneWeek = tasks.filter(
      (t) => t.status === "done" && t.createdAt >= weekAgoStamp
    ).length;

    return [
      { label: "To do", value: todo, hint: "waiting to start", accent: "text-zinc-300" },
      { label: "In progress", value: doing, hint: "active now", accent: "text-blue-400" },
      { label: "High priority", value: highOpen, hint: "open & urgent", accent: "text-rose-400" },
      { label: "Done this week", value: doneWeek, hint: "completed", accent: "text-emerald-400" },
    ];
  }, [tasks]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-xs font-medium text-zinc-500">{m.label}</p>
          <p className={`mt-1 text-3xl font-bold tracking-tight ${m.accent}`}>
            {m.value}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">{m.hint}</p>
        </div>
      ))}
    </div>
  );
}
