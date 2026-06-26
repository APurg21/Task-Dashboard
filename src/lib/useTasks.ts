"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ParsedTask } from "./parse";
import { newId, Priority, Status, Task } from "./types";

const STORAGE_KEY = "task-dashboard.tasks.v1";

const SEED: Task[] = [
  { id: "seed-1", title: "Welcome! Edit or delete this task", status: "todo", priority: "medium", createdAt: 1 },
  { id: "seed-2", title: "Quick-add a task above, or paste a list / CSV", status: "todo", priority: "high", createdAt: 2 },
  { id: "seed-3", title: "Drag cards between columns (or use the arrows)", status: "doing", priority: "low", createdAt: 3 },
  { id: "seed-4", title: "Toggle between Kanban and List views", status: "done", priority: "medium", createdAt: 4 },
];

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    (t.status === "todo" || t.status === "doing" || t.status === "done") &&
    (t.priority === "low" || t.priority === "medium" || t.priority === "high") &&
    typeof t.createdAt === "number"
  );
}

// --- Module-level store, read via useSyncExternalStore -----------------------

const EMPTY: Task[] = [];
let store: Task[] | null = null; // null until first client read
const listeners = new Set<() => void>();
let seq = 0;

function loadFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return SEED;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTask) : [];
  } catch {
    return [];
  }
}

function getSnapshot(): Task[] {
  if (store === null) store = loadFromStorage();
  return store;
}

function getServerSnapshot(): Task[] {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setStore(updater: (prev: Task[]) => Task[]): void {
  const next = updater(getSnapshot());
  store = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage full or unavailable — keep the in-memory value
  }
  listeners.forEach((l) => l());
}

// Monotonic timestamp so newly added tasks keep a stable order within a session.
function nextStamp(): number {
  seq += 1;
  return Date.now() * 1000 + (seq % 1000);
}

// --- Hook --------------------------------------------------------------------

export function useTasks() {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // false during SSR / first hydration render, true once on the client.
  const loaded = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const addTask = useCallback(
    (title: string, priority: Priority = "medium", status: Status = "todo") => {
      const trimmed = title.trim();
      if (!trimmed) return;
      setStore((prev) => [
        { id: newId(), title: trimmed, status, priority, createdAt: nextStamp() },
        ...prev,
      ]);
    },
    []
  );

  const addMany = useCallback((parsed: ParsedTask[]) => {
    const toAdd: Task[] = parsed
      .filter((p) => p.title.trim().length > 0)
      .map((p) => ({
        id: newId(),
        title: p.title.trim(),
        status: p.status ?? "todo",
        priority: p.priority ?? "medium",
        createdAt: nextStamp(),
      }));
    if (toAdd.length === 0) return 0;
    setStore((prev) => [...toAdd, ...prev]);
    return toAdd.length;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Omit<Task, "id">>) => {
    setStore((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeTask = useCallback((id: string) => {
    setStore((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    setStore((prev) => prev.filter((t) => t.status !== "done"));
  }, []);

  return { tasks, loaded, addTask, addMany, updateTask, removeTask, clearDone };
}
