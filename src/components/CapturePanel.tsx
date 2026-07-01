"use client";

import { useState } from "react";
import {
  NOTE_FOLDERS,
  NOTE_TYPE_LABELS,
  NOTE_TYPES,
  type NoteClassification,
  type NoteType,
} from "@/lib/notes";

interface Props {
  // Existing project titles, passed to the classifier so "current project"
  // notes can be matched to something the user is already working on.
  projects?: string[];
  // Called after the planner adds tasks server-side, so the board can refresh.
  onPlanned?: () => void;
}

type Stage = "idle" | "classifying" | "pushing" | "planning" | "deep";

interface PlanResult {
  title: string;
  milestones: { name: string; count: number }[];
  taskCount: number;
  persisted: boolean;
}

interface DeepState {
  status: string;
  message: string;
  done?: boolean;
  title?: string;
  milestones?: number;
  taskCount?: number;
}

const TYPE_STYLES: Record<NoteType, string> = {
  "current-project":
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "new-project":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  brainstorm:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  task: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  daily: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function CapturePanel({ projects = [], onPlanned }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<NoteClassification | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [deep, setDeep] = useState<DeepState | null>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function handleFile(f: File | null | undefined) {
    if (!f) return;
    // Text-based files (CSV, TXT, MD, JSON). PDFs/images need extra handling.
    const content = await f.text().catch(() => "");
    setFile({ name: f.name, text: content });
    setError(null);
  }

  async function deepPlan() {
    if (!text.trim() && !file) return;
    setStage("deep");
    setError(null);
    setFlash(null);
    setPlan(null);
    setDeep({ status: "queued", message: "Starting the agents…" });
    try {
      const res = await fetch("/api/projects/plan-deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          fileText: file?.text ?? "",
          fileName: file?.name ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.jobId) {
        setError(data.error ?? "Couldn't start the deep plan.");
        setStage("idle");
        setDeep(null);
        return;
      }
      setText("");
      setFile(null);
      // Poll for progress (cap ~10 min). The bot also texts you updates.
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const job = await fetch(`/api/projects/plan-deep?id=${data.jobId}`)
          .then((r) => r.json())
          .catch(() => null);
        if (!job) continue;
        if (job.status === "done") {
          setDeep({
            status: "done",
            message: "Done.",
            done: true,
            title: job.plan?.projectTitle,
            milestones: job.plan?.milestones?.length,
            taskCount: job.taskCount,
          });
          onPlanned?.();
          setStage("idle");
          return;
        }
        if (job.status === "error") {
          setError(job.error ?? "Deep plan failed.");
          setStage("idle");
          setDeep(null);
          return;
        }
        setDeep({ status: job.status, message: job.message ?? "Working…" });
      }
      setStage("idle");
    } catch {
      setError("Lost contact with the planner — it may still finish (check Telegram).");
      setStage("idle");
    }
  }

  async function makePlan() {
    if (!text.trim()) return;
    setStage("planning");
    setError(null);
    setFlash(null);
    try {
      const res = await fetch("/api/projects/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Planning failed.");
        setStage("idle");
        return;
      }
      setPlan({
        title: data.plan.projectTitle,
        milestones: data.plan.milestones.map(
          (m: { name: string; tasks: unknown[] }) => ({ name: m.name, count: m.tasks.length })
        ),
        taskCount: data.taskCount,
        persisted: data.persisted,
      });
      setText("");
      setStage("idle");
      if (data.persisted) onPlanned?.();
    } catch {
      setError("Couldn't reach the planner.");
      setStage("idle");
    }
  }

  async function classify() {
    if (!text.trim()) return;
    setStage("classifying");
    setError(null);
    setFlash(null);
    try {
      const res = await fetch("/api/notes/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, projects }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Classification failed.");
        setStage("idle");
        return;
      }
      setResult(data as NoteClassification);
      setStage("idle");
    } catch {
      setError("Couldn't reach the classifier.");
      setStage("idle");
    }
  }

  async function push() {
    if (!result) return;
    setStage("pushing");
    setError(null);
    try {
      const res = await fetch("/api/notes/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification: result, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Push failed.");
        setStage("idle");
        return;
      }
      setFlash(`Saved to ${data.path}`);
      setText("");
      setResult(null);
      setStage("idle");
      window.setTimeout(() => setFlash(null), 4000);
    } catch {
      setError("Couldn't reach Obsidian.");
      setStage("idle");
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setStage("idle");
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-200"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>
            ▸
          </span>
          Capture a note → Obsidian
        </span>
        {flash && !open && <span className="text-xs font-normal text-emerald-600">{flash}</span>}
      </button>

      {open && (
        <div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Drop any thought — Claude sorts it into a current project, a new project idea, a brainstorm, or a task, then files it in your vault."
            rows={4}
            disabled={stage === "classifying" || stage === "pushing"}
            className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />

          {/* Drop a CSV/text file for the multi-agent deep planner to analyze. */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${
              dragOver
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {file ? (
              <>
                <span className="truncate text-zinc-600 dark:text-zinc-300">
                  📎 {file.name}{" "}
                  <span className="text-zinc-400">
                    ({Math.max(1, Math.round(file.text.length / 1000))}k chars)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="shrink-0 text-zinc-500 hover:text-rose-500"
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                <span className="text-zinc-500">
                  Drop a CSV/text file here → the deep planner analyzes it.
                </span>
                <label className="shrink-0 cursor-pointer rounded-md border border-zinc-300 px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Attach
                  <input
                    type="file"
                    accept=".csv,.txt,.md,.json,.tsv,text/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </label>
              </>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          )}

          {!result && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                Classify → Obsidian · Plan → quick milestones · Deep plan → multi-agent (texts you).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {flash && <span className="text-xs text-emerald-600">{flash}</span>}
                <button
                  type="button"
                  onClick={deepPlan}
                  disabled={(!text.trim() && !file) || stage !== "idle"}
                  className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
                >
                  {stage === "deep" ? "Working…" : "Deep plan"}
                </button>
                <button
                  type="button"
                  onClick={makePlan}
                  disabled={!text.trim() || stage !== "idle"}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {stage === "planning" ? "Planning…" : "Plan as project"}
                </button>
                <button
                  type="button"
                  onClick={classify}
                  disabled={!text.trim() || stage !== "idle"}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stage === "classifying" ? "Classifying…" : "Classify"}
                </button>
              </div>
            </div>
          )}

          {deep && (
            <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/40">
              {!deep.done ? (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                  <span className="text-sm text-violet-800 dark:text-violet-300">{deep.message}</span>
                  <span className="ml-auto text-[11px] text-violet-500">agents working — you’ll get a text</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">
                      🧠 {deep.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeep(null)}
                      className="text-xs text-violet-700 hover:underline dark:text-violet-400"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-xs text-violet-700 dark:text-violet-400">
                    {deep.milestones} milestones · {deep.taskCount} tasks — open the Projects view. Queued for Obsidian.
                  </p>
                </div>
              )}
            </div>
          )}

          {plan && (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  📋 {plan.title}
                </span>
                <button
                  type="button"
                  onClick={() => setPlan(null)}
                  className="text-xs text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Dismiss
                </button>
              </div>
              <ul className="space-y-0.5">
                {plan.milestones.map((m, i) => (
                  <li key={i} className="text-xs text-emerald-900 dark:text-emerald-200">
                    {i + 1}. {m.name}{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">({m.count})</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {plan.persisted
                  ? `Added ${plan.taskCount} tasks — open the Projects view. Queued for Obsidian.`
                  : `Generated ${plan.taskCount} tasks, but couldn't save (is the database connected locally?).`}
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/50">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[result.noteType]}`}
                >
                  {NOTE_TYPE_LABELS[result.noteType]}
                </span>
                {result.matchedProject && (
                  <span className="text-xs text-zinc-500">→ {result.matchedProject}</span>
                )}
                <span className="ml-auto font-mono text-[11px] text-zinc-400">
                  {NOTE_FOLDERS[result.noteType]}/
                </span>
              </div>

              <label className="block text-xs font-medium text-zinc-500">
                Title
                <input
                  type="text"
                  value={result.title}
                  onChange={(e) => setResult({ ...result, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>

              <label className="block text-xs font-medium text-zinc-500">
                Destination
                <select
                  value={result.noteType}
                  onChange={(e) =>
                    setResult({ ...result, noteType: e.target.value as NoteType })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  {NOTE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {NOTE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>

              {result.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={push}
                  disabled={stage === "pushing" || !result.title.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stage === "pushing" ? "Saving…" : "Save to Obsidian"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
