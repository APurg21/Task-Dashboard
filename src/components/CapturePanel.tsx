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
}

type Stage = "idle" | "classifying" | "pushing";

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

export default function CapturePanel({ projects = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<NoteClassification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

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

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          )}

          {!result && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                Needs an Anthropic API key and the Obsidian Local REST API plugin. See SETUP.md.
              </p>
              <div className="flex items-center gap-2">
                {flash && <span className="text-xs text-emerald-600">{flash}</span>}
                <button
                  type="button"
                  onClick={classify}
                  disabled={!text.trim() || stage === "classifying"}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stage === "classifying" ? "Classifying…" : "Classify"}
                </button>
              </div>
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
