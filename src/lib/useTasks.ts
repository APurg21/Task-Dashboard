"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ParsedTask } from "./parse";
import { newId, Priority, Status, Task } from "./types";

// --- Module-level store backed by /api/tasks ---------------------------------
// Keeps the same useSyncExternalStore pattern to avoid set-state-in-effect lint.
// Data loading is triggered inside subscribe(), which only runs on the client.

const EMPTY: Task[] = [];
let store: Task[] | null = null; // null = not yet loaded
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function getSnapshot(): Task[] {
  return store ?? EMPTY;
}

function getServerSnapshot(): Task[] {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!initialized) {
    initialized = true;
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((tasks: unknown) => {
        store = Array.isArray(tasks) ? (tasks as Task[]) : [];
        notify();
      })
      .catch(() => {
        store = [];
        notify();
      });
  }
  return () => listeners.delete(cb);
}

let seq = 0;
function nextStamp(): number {
  seq += 1;
  return Date.now() * 1000 + (seq % 1000);
}

// --- Hook --------------------------------------------------------------------

export function useTasks() {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const loaded = useSyncExternalStore(
    () => () => {},
    () => store !== null,
    () => false
  );

  const addTask = useCallback(
    (title: string, priority: Priority = "medium", status: Status = "todo") => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const task: Task = {
        id: newId(),
        title: trimmed,
        status,
        priority,
        createdAt: nextStamp(),
      };
      store = [task, ...(store ?? [])];
      notify();
      fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      }).catch(() => {});
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
    store = [...toAdd, ...(store ?? [])];
    notify();
    Promise.all(
      toAdd.map((task) =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        })
      )
    ).catch(() => {});
    return toAdd.length;
  }, []);

  const updateTask = useCallback(
    (id: string, patch: Partial<Omit<Task, "id">>) => {
      store = (store ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t));
      notify();
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
    },
    []
  );

  const removeTask = useCallback((id: string) => {
    store = (store ?? []).filter((t) => t.id !== id);
    notify();
    fetch(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const clearDone = useCallback(() => {
    const toRemove = (store ?? [])
      .filter((t) => t.status === "done")
      .map((t) => t.id);
    store = (store ?? []).filter((t) => t.status !== "done");
    notify();
    Promise.all(
      toRemove.map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" }))
    ).catch(() => {});
  }, []);

  return { tasks, loaded, addTask, addMany, updateTask, removeTask, clearDone };
}
