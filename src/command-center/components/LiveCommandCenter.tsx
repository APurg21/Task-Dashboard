"use client";
import React, { useMemo } from "react";
import { useTasks } from "@/lib/useTasks";
import type { Task as BoardTask } from "@/lib/types";
import { commandCenterMock } from "../lib/mock";
import type { CommandCenterData, Task as CCTask, LifePriority, LifeTag, Priority } from "../lib/types";
import { CommandCenter } from "./CommandCenter";

// Integration layer: the cockpit reads live state from the real task board
// (Redis via /api/tasks) so what you capture / text / plan shows up here, and
// checking a Top-3 item off writes back to the board. Everything else still
// comes from the mock until its adapter is wired.

const RANK: Record<Priority | "medium", number> = { high: 3, med: 2, medium: 2, low: 1 };

function toCCPriority(p: BoardTask["priority"]): Priority {
  return p === "medium" ? "med" : (p as Priority);
}

// Rough life-area tag from the title so personal items get a sensible chip.
function tagFor(title: string): LifeTag {
  const t = title.toLowerCase();
  if (/\b(gym|lift|run|workout|push|pull|legs|golf|walk|cardio|sleep|body|train)\b/.test(t)) return "body";
  if (/\$|\b(money|brokerage|pay|bill|budget|invest|save|rent|refund)\b/.test(t)) return "money";
  if (/\b(call|text|mom|dad|dinner|friend|family|birthday|coffee|meet)\b/.test(t)) return "people";
  if (/\b(admin|form|renew|file|paperwork|appointment|dmv|insurance|tax)\b/.test(t)) return "admin";
  return "mind";
}

function byPriorityThenRecent(a: BoardTask, b: BoardTask): number {
  const r = (RANK[b.priority] ?? 0) - (RANK[a.priority] ?? 0);
  return r !== 0 ? r : b.createdAt - a.createdAt;
}

export function LiveCommandCenter() {
  const { tasks, loaded, updateTask } = useTasks();

  const data: CommandCenterData = useMemo(() => {
    if (!loaded) return commandCenterMock;

    const open = tasks.filter((t) => t.status !== "done");

    const topTasks: CCTask[] = open
      .filter((t) => t.context === "work")
      .sort(byPriorityThenRecent)
      .slice(0, 3)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: toCCPriority(t.priority),
        done: false,
        source: t.source,
        sub: t.project ? `${t.project}` : undefined,
      }));

    const lifePriorities: LifePriority[] = open
      .filter((t) => t.context !== "work")
      .sort(byPriorityThenRecent)
      .slice(0, 3)
      .map((t) => ({ id: t.id, title: t.title, tag: tagFor(t.title), done: false }));

    return {
      ...commandCenterMock,
      daily: {
        ...commandCenterMock.daily,
        // Fall back to the mock samples only when the board has nothing of that kind.
        topTasks: topTasks.length ? topTasks : commandCenterMock.daily.topTasks,
        lifePriorities: lifePriorities.length ? lifePriorities : commandCenterMock.daily.lifePriorities,
      },
    };
  }, [tasks, loaded]);

  // Only real board ids get written back; mock-fallback ids (t1/p1…) are ignored.
  const realIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const onToggleTask = (id: string, done: boolean) => {
    if (!realIds.has(id)) return;
    updateTask(id, { status: done ? "done" : "todo" });
  };

  return <CommandCenter data={data} onToggleTask={onToggleTask} />;
}
