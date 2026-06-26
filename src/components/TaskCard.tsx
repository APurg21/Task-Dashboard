"use client";

import { useState } from "react";
import { Priority, PRIORITIES, Status, STATUSES, Task } from "@/lib/types";
import PriorityBadge from "./PriorityBadge";

interface Props {
  task: Task;
  onUpdate: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  onRemove: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}

export default function TaskCard({
  task,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  dragging,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const statusIdx = STATUSES.findIndex((s) => s.id === task.status);
  const prev = STATUSES[statusIdx - 1];
  const next = STATUSES[statusIdx + 1];

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
    <div
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart?.(task.id);
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition dark:border-zinc-700 dark:bg-zinc-800 ${
        dragging ? "opacity-40" : ""
      } ${editing ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          rows={2}
          className="w-full resize-none rounded border border-blue-400 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-zinc-900 dark:text-zinc-100"
        />
      ) : (
        <p
          onDoubleClick={() => {
            setDraft(task.title);
            setEditing(true);
          }}
          className={`text-sm leading-snug ${
            task.status === "done"
              ? "text-zinc-400 line-through dark:text-zinc-500"
              : "text-zinc-800 dark:text-zinc-100"
          }`}
        >
          {task.title}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={cyclePriority}
          title="Change priority"
          className="rounded-full outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <PriorityBadge priority={task.priority} />
        </button>

        <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
          <IconButton
            label={prev ? `Move to ${prev.label}` : "Already in first column"}
            disabled={!prev}
            onClick={() => prev && onUpdate(task.id, { status: prev.id as Status })}
          >
            ←
          </IconButton>
          <IconButton
            label={next ? `Move to ${next.label}` : "Already in last column"}
            disabled={!next}
            onClick={() => next && onUpdate(task.id, { status: next.id as Status })}
          >
            →
          </IconButton>
          <IconButton
            label="Edit task"
            onClick={() => {
              setDraft(task.title);
              setEditing(true);
            }}
          >
            ✎
          </IconButton>
          <IconButton label="Delete task" danger onClick={() => onRemove(task.id)}>
            ✕
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? "text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
