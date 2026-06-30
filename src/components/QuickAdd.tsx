"use client";

import { useState } from "react";
import { LifeContext, Priority, PRIORITIES } from "@/lib/types";

interface Props {
  onAdd: (title: string, priority: Priority, context: LifeContext) => void;
  // The section the user is currently viewing, used as the default context.
  defaultContext?: LifeContext;
}

export default function QuickAdd({ onAdd, defaultContext = "personal" }: Props) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [context, setContext] = useState<LifeContext>(defaultContext);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title, priority, context);
    setTitle("");
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task and press Enter…"
        aria-label="Task title"
        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <div className="flex gap-2">
        <div className="flex rounded-lg border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
          {(["personal", "work"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setContext(c)}
              aria-pressed={context === c}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                context === c
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          aria-label="Priority"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm capitalize text-zinc-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!title.trim()}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}
