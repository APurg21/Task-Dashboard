"use client";

import { useMemo } from "react";
import { toMs, type Task } from "@/lib/types";

interface Props {
  tasks: Task[];
  onUpdate: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  onRemove: (id: string) => void;
}

interface MilestoneGroup {
  name: string;
  tasks: Task[];
}
interface ProjectGroup {
  name: string;
  milestones: MilestoneGroup[];
  done: number;
  total: number;
}

// Group the project-tagged tasks by project, then milestone, preserving plan
// order (tasks were created with increasing createdAt in milestone order).
function groupProjects(tasks: Task[]): ProjectGroup[] {
  const withProject = tasks
    .filter((t) => t.project)
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

  const byProject = new Map<string, Task[]>();
  for (const t of withProject) {
    const key = t.project as string;
    (byProject.get(key) ?? byProject.set(key, []).get(key)!).push(t);
  }

  const groups: ProjectGroup[] = [];
  for (const [name, projectTasks] of byProject) {
    const byMilestone = new Map<string, Task[]>();
    for (const t of projectTasks) {
      const key = t.milestone ?? "Tasks";
      (byMilestone.get(key) ?? byMilestone.set(key, []).get(key)!).push(t);
    }
    const milestones: MilestoneGroup[] = [...byMilestone.entries()].map(
      ([mName, mTasks]) => ({ name: mName, tasks: mTasks })
    );
    const done = projectTasks.filter((t) => t.status === "done").length;
    groups.push({ name, milestones, done, total: projectTasks.length });
  }
  return groups;
}

export default function ProjectsView({ tasks, onUpdate, onRemove }: Props) {
  const projects = useMemo(() => groupProjects(tasks), [tasks]);

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-300">No project plans yet</p>
        <p className="mt-1 text-sm text-zinc-500">
          Text your bot <span className="font-mono text-zinc-400">plan: …</span> or use “Plan as project” in capture.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((p) => {
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        return (
          <section
            key={p.name}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-zinc-100">{p.name}</h3>
              <span className="text-xs text-zinc-500">
                {p.done}/{p.total} done
              </span>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="space-y-4">
              {p.milestones.map((m) => (
                <div key={m.name}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {m.name}
                  </p>
                  <ul className="space-y-1">
                    {m.tasks.map((t) => {
                      const done = t.status === "done";
                      return (
                        <li
                          key={t.id}
                          className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-800/50"
                        >
                          <button
                            type="button"
                            aria-label={done ? "Mark not done" : "Mark done"}
                            onClick={() =>
                              onUpdate(t.id, { status: done ? "todo" : "done" })
                            }
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                              done
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-zinc-600 text-transparent hover:border-emerald-500"
                            }`}
                          >
                            ✓
                          </button>
                          <span
                            className={`flex-1 text-sm ${
                              done ? "text-zinc-500 line-through" : "text-zinc-200"
                            }`}
                          >
                            {t.title}
                          </span>
                          {t.priority === "high" && !done && (
                            <span className="rounded-full bg-rose-500/15 px-1.5 text-[10px] font-medium text-rose-400">
                              high
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label="Delete task"
                            onClick={() => onRemove(t.id)}
                            className="text-zinc-600 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
