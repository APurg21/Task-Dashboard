"use client";

import { useMemo, useState } from "react";
import { parseImport } from "@/lib/parse";
import { useTasks } from "@/lib/useTasks";
import type { LifeContext } from "@/lib/types";
import QuickAdd from "@/components/QuickAdd";
import ImportPanel from "@/components/ImportPanel";
import CapturePanel from "@/components/CapturePanel";
import ChatPanel from "@/components/ChatPanel";
import KanbanBoard from "@/components/KanbanBoard";
import ListView from "@/components/ListView";
import ProjectsView from "@/components/ProjectsView";
import MetricCards from "@/components/MetricCards";
import Sidebar, { type Section } from "@/components/Sidebar";

type View = "kanban" | "list" | "projects";

export default function Home() {
  const { tasks, loaded, addTask, addMany, updateTask, removeTask, clearDone, reload } = useTasks();
  const [view, setView] = useState<View>("kanban");
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<Section>("all");

  // A task with no context counts as personal (manual quick-adds default there).
  const inSection = useMemo(
    () => (ctx: LifeContext | undefined) => {
      if (section === "all") return true;
      if (section === "work") return ctx === "work";
      return ctx !== "work";
    },
    [section]
  );

  const sectionTasks = useMemo(
    () => tasks.filter((t) => inSection(t.context)),
    [tasks, inSection]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sectionTasks;
    return sectionTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [sectionTasks, query]);

  const counts = useMemo<Record<Section, number>>(
    () => ({
      all: tasks.length,
      personal: tasks.filter((t) => t.context !== "work").length,
      work: tasks.filter((t) => t.context === "work").length,
    }),
    [tasks]
  );

  // In-progress titles in this section act as "current projects" for the
  // classifier, and as the default context for new manual tasks.
  const activeProjects = useMemo(
    () => sectionTasks.filter((t) => t.status !== "done").map((t) => t.title),
    [sectionTasks]
  );
  const defaultContext: LifeContext = section === "work" ? "work" : "personal";
  const doneCount = sectionTasks.filter((t) => t.status === "done").length;

  return (
    <div className="min-h-screen bg-black">
      <Sidebar section={section} onSection={setSection} counts={counts} />

      <div className="lg:ml-60">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <h1 className="text-lg font-bold capitalize tracking-tight text-zinc-50">
              {section === "all" ? "Dashboard" : section}
            </h1>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
              {sectionTasks.length} task{sectionTasks.length === 1 ? "" : "s"}
            </span>

            <div className="ml-auto flex items-center gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Search tasks"
                className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:w-44"
              />
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {/* Mobile section switcher (sidebar is hidden below lg). */}
          <div className="flex gap-2 px-4 pb-3 lg:hidden">
            {(["all", "personal", "work"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                aria-pressed={section === s}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  section === s
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {s} ({counts[s]})
              </button>
            ))}
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
          <MetricCards tasks={sectionTasks} />

          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <QuickAdd
              onAdd={(title, priority, context) =>
                addTask(title, priority, "todo", context)
              }
              defaultContext={defaultContext}
            />
          </section>

          <ChatPanel />

          <CapturePanel projects={activeProjects} onPlanned={reload} />

          <ImportPanel
            onImport={(text, context) => addMany(parseImport(text), context)}
            defaultContext={defaultContext}
          />

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
          ) : sectionTasks.length === 0 ? (
            <EmptyState />
          ) : view === "projects" ? (
            <ProjectsView tasks={filtered} onUpdate={updateTask} onRemove={removeTask} />
          ) : view === "kanban" ? (
            <KanbanBoard tasks={filtered} onUpdate={updateTask} onRemove={removeTask} />
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-400">No tasks match “{query}”.</p>
          ) : (
            <ListView tasks={filtered} onUpdate={updateTask} onRemove={removeTask} />
          )}
        </main>
      </div>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
      {(["kanban", "list", "projects"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
            view === v
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-100"
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
    <div className="rounded-xl border border-dashed border-zinc-700 px-6 py-16 text-center">
      <p className="text-sm font-medium text-zinc-300">No tasks here yet</p>
      <p className="mt-1 text-sm text-zinc-500">
        Add one above, capture a note, paste a list — or text your Telegram bot.
      </p>
    </div>
  );
}
