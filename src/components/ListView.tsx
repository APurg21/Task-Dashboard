"use client";

import { useState } from "react";
import { Priority, PRIORITIES, Status, STATUSES, Task } from "@/lib/types";
import PriorityBadge from "./PriorityBadge";

interface Props {
  tasks: Task[];
  onUpdate: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  onRemove: (id: string) => void;
}

export default function ListView({ tasks, onUpdate, onRemove }: Props) {
  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {tasks.map((task) => (
        <Row key={task.id} task={task} onUpdate={onUpdate} onRemove={onRemove} />
      ))}
    </ul>
  );
}

function Row({ task, onUpdate, onRemove }: { task: Task } & Omit<Props, "tasks">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const done = task.status === "done";

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) onUpdate(task.id, { title: trimmed });
    else setDraft(task.title);
    setEditing(false);
  }

  function cyclePriority() {
    const i = PRIORITIES.indexOf(task.priority);
    onUpdate(task.id, { priority: PRIORITIES[(i + 1) % PRIORITIES.length] as Priority });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <input
        type="checkbox"
        checked={done}
        onChange={(e) => onUpdate(task.id, { status: e.target.checked ? "done" : "todo" })}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
      />

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          className="order-last w-full min-w-0 flex-1 rounded border border-blue-400 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30 sm:order-none sm:w-auto dark:bg-zinc-950 dark:text-zinc-100"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={() => {
            setDraft(task.title);
            setEditing(true);
          }}
          onClick={() => {
            setDraft(task.title);
            setEditing(true);
          }}
          className={`order-last w-full min-w-0 flex-1 truncate text-left text-sm sm:order-none sm:w-auto ${
            done
              ? "text-zinc-400 line-through dark:text-zinc-500"
              : "text-zinc-800 dark:text-zinc-100"
          }`}
        >
          {task.title}
        </button>
      )}

      <button
        type="button"
        onClick={cyclePriority}
        title="Change priority"
        className="rounded-full outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <PriorityBadge priority={task.priority} />
      </button>

      <select
        value={task.status}
        onChange={(e) => onUpdate(task.id, { status: e.target.value as Status })}
        aria-label="Status"
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      >
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onRemove(task.id)}
        aria-label="Delete task"
        title="Delete task"
        className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
      >
        ✕
      </button>
    </li>
  );
}
