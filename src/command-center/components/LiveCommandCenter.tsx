"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTasks } from "@/lib/useTasks";
import { toMs, type Task as BoardTask } from "@/lib/types";
import { commandCenterMock } from "../lib/mock";
import type {
  CommandCenterData, Task as CCTask, LifePriority, LifeTag, Priority, BlindSpot,
} from "../lib/types";
import { CommandCenter } from "./CommandCenter";

// Integration layer between the cockpit and the real systems:
//  • Today's Top-3 Work / Life derive from live Redis tasks (write-back on check)
//  • "Curate" asks the Chief of Staff to re-rank them (on demand)
//  • "What am I missing" is computed from real open tasks
//  • Voice → Task creates a real, classified task
//  • Everything else comes from the server-persisted profile (editable), which
//    falls back to the sample mock until you save your own.

const RANK: Record<string, number> = { high: 3, med: 2, medium: 2, low: 1 };

function toCCPriority(p: BoardTask["priority"]): Priority {
  return p === "medium" ? "med" : (p as Priority);
}

function tagFor(title: string): LifeTag {
  const t = title.toLowerCase();
  if (/\b(gym|lift|run|workout|push|pull|legs|golf|walk|cardio|sleep|body|train)\b/.test(t)) return "body";
  if (/\$|\b(money|brokerage|pay|bill|budget|invest|save|rent|refund)\b/.test(t)) return "money";
  if (/\b(call|text|mom|dad|dinner|friend|family|birthday|coffee|meet)\b/.test(t)) return "people";
  if (/\b(admin|form|renew|file|paperwork|appointment|dmv|insurance|tax)\b/.test(t)) return "admin";
  return "mind";
}

function ageDaysOf(createdAt: number): number {
  return Math.max(0, (Date.now() - toMs(createdAt)) / 86_400_000);
}

function byPriorityThenRecent(a: BoardTask, b: BoardTask): number {
  const r = (RANK[b.priority] ?? 0) - (RANK[a.priority] ?? 0);
  return r !== 0 ? r : toMs(b.createdAt) - toMs(a.createdAt);
}

type Curated = { work: string[]; life: string[]; why: string };

export function LiveCommandCenter() {
  const { tasks, loaded, updateTask, reload } = useTasks();
  const [profile, setProfile] = useState<CommandCenterData | null>(null);
  const [curated, setCurated] = useState<Curated | null>(null);
  const [curating, setCurating] = useState(false);

  // Load the saved profile once (falls back to the sample mock).
  useEffect(() => {
    fetch("/api/command/profile")
      .then((r) => r.json())
      .then((d) => setProfile((d.profile as CommandCenterData) ?? commandCenterMock))
      .catch(() => setProfile(commandCenterMock));
  }, []);

  const base = profile ?? commandCenterMock;
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);

  const data: CommandCenterData = useMemo(() => {
    const workOpen = openTasks.filter((t) => t.context === "work");
    const lifeOpen = openTasks.filter((t) => t.context !== "work");

    const pick = (pool: BoardTask[], ids?: string[]) => {
      if (ids && ids.length) {
        const map = new Map(pool.map((t) => [t.id, t]));
        return ids.map((id) => map.get(id)).filter(Boolean).slice(0, 3) as BoardTask[];
      }
      return [...pool].sort(byPriorityThenRecent).slice(0, 3);
    };

    const subFor = (t: BoardTask) => {
      const parts: string[] = [];
      if (t.entityType && t.entityType !== "task") parts.push(t.entityType);
      if (t.dueAt) parts.push("due " + new Date(t.dueAt).toISOString().slice(0, 10));
      if (t.project) parts.push(t.project);
      return parts.length ? parts.join(" · ") : undefined;
    };

    const topTasks: CCTask[] = pick(workOpen, curated?.work).map((t) => ({
      id: t.id, title: t.title, priority: toCCPriority(t.priority), done: false, source: t.source,
      sub: subFor(t),
    }));
    const lifePriorities: LifePriority[] = pick(lifeOpen, curated?.life).map((t) => ({
      id: t.id, title: t.title, tag: tagFor(t.title), done: false, sub: subFor(t),
    }));

    // The date is always computed — never the stale saved/mock label
    // (the deployed header sat on "Wed · Jul 1" for weeks).
    const now = new Date();
    const dateLabel = `${now.toLocaleDateString("en-US", { weekday: "short" })} · ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    return {
      ...base,
      daily: {
        ...base.daily,
        dateLabel,
        topTasks: topTasks.length ? topTasks : base.daily.topTasks,
        lifePriorities: lifePriorities.length ? lifePriorities : base.daily.lifePriorities,
      },
    };
  }, [base, openTasks, curated]);

  // Real "What am I missing" from the live board.
  const blindspots: BlindSpot[] = useMemo(() => {
    const spots: BlindSpot[] = [];
    const highs = openTasks.filter((t) => t.priority === "high");
    const stalled = openTasks.filter((t) => ageDaysOf(t.createdAt) > 7);
    const untagged = openTasks.filter((t) => !t.context);

    if (highs.length) {
      spots.push({
        id: "high", severity: "critical",
        title: `${highs.length} high-priority task${highs.length === 1 ? "" : "s"} still open`,
        detail: highs.slice(0, 3).map((t) => t.title).join(" · "),
      });
    }
    if (stalled.length) {
      spots.push({
        id: "stalled", severity: "warn",
        title: `${stalled.length} task${stalled.length === 1 ? "" : "s"} stalled over a week`,
        detail: stalled.slice(0, 3).map((t) => `${t.title} (${Math.round(ageDaysOf(t.createdAt))}d)`).join(" · "),
      });
    }
    if (untagged.length) {
      spots.push({
        id: "untagged", severity: "warn",
        title: `${untagged.length} task${untagged.length === 1 ? "" : "s"} not tagged work/personal`,
        detail: "Untagged tasks default to personal and won't show in Top-3 Work.",
      });
    }
    if (!highs.length) {
      spots.push({ id: "ok", severity: "good", title: "No high-priority fires right now — nice." });
    }
    return spots;
  }, [openTasks]);

  const realIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const onToggleTask = useCallback((id: string, done: boolean) => {
    if (!realIds.has(id)) return;
    updateTask(id, { status: done ? "done" : "todo" });
  }, [realIds, updateTask]);

  // Save the editable profile server-side (visible from any device).
  const onSaveProfile = useCallback(async (next: CommandCenterData) => {
    setProfile(next);
    await fetch("/api/command/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
    }).catch(() => {});
  }, []);

  // Chief-of-staff curation of the Top-3 (on demand).
  const onCurate = useCallback(async () => {
    setCurating(true);
    try {
      const payload = openTasks.map((t) => ({
        id: t.id, title: t.title, priority: t.priority,
        context: t.context ?? "personal", ageDays: Math.round(ageDaysOf(t.createdAt)),
      }));
      const res = await fetch("/api/command/curate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks: payload }),
      });
      const d = await res.json();
      if (res.ok) setCurated({ work: d.work ?? [], life: d.life ?? [], why: d.why ?? "" });
    } catch { /* keep the deterministic order on failure */ } finally {
      setCurating(false);
    }
  }, [openTasks]);

  // Voice → Task: classify the note and create a real task.
  const onCapture = useCallback(async (text: string) => {
    const c = await fetch("/api/notes/classify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, projects: [] }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const title = (c?.title as string) || text.trim().slice(0, 80);
    const context = c?.context as string | undefined;
    const priority = (c?.priority as string) || "medium";
    await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority, context, status: "todo", source: "ui" }),
    }).catch(() => {});
    reload();
    return { title, context: context ?? "personal", priority };
  }, [reload]);

  return (
    <CommandCenter
      data={data}
      onToggleTask={onToggleTask}
      onSaveProfile={onSaveProfile}
      blindspots={blindspots}
      onCurate={onCurate}
      curating={curating}
      curateWhy={curated?.why}
      onCapture={onCapture}
      ready={loaded && profile !== null}
    />
  );
}
