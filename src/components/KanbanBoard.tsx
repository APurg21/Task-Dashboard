"use client";

import { useState } from "react";
import { Status, STATUSES, Task } from "@/lib/types";
import TaskCard from "./TaskCard";

interface Props {
  tasks: Task[];
  onUpdate: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  onRemove: (id: string) => void;
}

export default function KanbanBoard({ tasks, onUpdate, onRemove }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  function drop(status: Status) {
    if (draggingId) onUpdate(draggingId, { status });
    setDraggingId(null);
    setOverCol(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {STATUSES.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        return (
          <section
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overCol !== col.id) setOverCol(col.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            onDrop={() => drop(col.id)}
            className={`flex flex-col rounded-xl border bg-zinc-50/70 p-3 transition-colors dark:bg-zinc-900/40 ${
              overCol === col.id
                ? "border-blue-400 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${col.accent}`} aria-hidden />
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {col.label}
              </h2>
              <span className="ml-auto rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {colTasks.length}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {colTasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700">
                  Drop tasks here
                </p>
              ) : (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    onDragStart={setDraggingId}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverCol(null);
                    }}
                    dragging={draggingId === task.id}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
