"use client";

import { useMemo, useState } from "react";
import { parseImport } from "@/lib/parse";
import { useTasks } from "@/lib/useTasks";
import QuickAdd from "@/components/QuickAdd";
import ImportPanel from "@/components/ImportPanel";
import KanbanBoard from "@/components/KanbanBoard";
import ListView from "@/components/ListView";

type View = "kanban" | "list";

export default function Home() {
  const { tasks, loaded, addTask, addMany, updateTask, removeTask, clearDone } = useTasks();
  const [view, setView] = useState<View>("kanban");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, query]);

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="min-h-full bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Task Dashboard
          </h1>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search tasks"
              className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:w-44 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <QuickAdd onAdd={addTask} />
        </section>

        <ImportPanel onImport={(text) => addMany(parseImport(text))} />

        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-zinc-500">
            {query
              ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}`
              : "Drag cards, double-click a title to edit, click a badge to change priority."}
          </p>
          {doneCount > 0 && (
            <button
              type="button"
              onClick={clearDone}
              className="text-xs font-medium text-zinc-500 transition-colors hover:text-rose-600"
            >
              Clear {doneCount} done
            </button>
          )}
        </div>

        {!loaded ? (
          <p className="py-16 text-center text-sm text-zinc-400">Loading…</p>
        ) : tasks.length === 0 ? (
          <EmptyState />
        ) : view === "kanban" ? (
          <KanbanBoard tasks={filtered} onUpdate={updateTask} onRemove={removeTask} />
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-400">No tasks match “{query}”.</p>
        ) : (
          <ListView tasks={filtered} onUpdate={updateTask} onRemove={removeTask} />
        )}
      </main>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex rounded-lg border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      {(["kanban", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
            view === v
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No tasks yet</p>
      <p className="mt-1 text-sm text-zinc-400">
        Add one above, or paste a list / CSV to get started.
      </p>
    </div>
  );
}
