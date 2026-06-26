"use client";

import { useMemo, useState } from "react";
import { parseImport } from "@/lib/parse";

interface Props {
  onImport: (text: string) => number;
}

const PLACEHOLDER = `Paste a list or CSV, e.g.

Buy groceries
- Call the dentist
[x] Submit expense report

…or CSV with headers:
title,status,priority
Ship release,in progress,high
Write docs,todo,low`;

export default function ImportPanel({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const preview = useMemo(() => parseImport(text), [text]);

  function handleImport() {
    const count = onImport(text);
    setText("");
    setFlash(count > 0 ? `Imported ${count} task${count === 1 ? "" : "s"}` : "Nothing to import");
    window.setTimeout(() => setFlash(null), 2500);
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
          Paste a list or CSV
        </span>
        {flash && !open && <span className="text-xs font-normal text-emerald-600">{flash}</span>}
      </button>

      {open && (
        <div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={7}
            className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {preview.length > 0
                ? `${preview.length} task${preview.length === 1 ? "" : "s"} detected`
                : "Bullets, numbers and [x] checkboxes are handled automatically."}
            </p>
            <div className="flex items-center gap-2">
              {flash && <span className="text-xs text-emerald-600">{flash}</span>}
              <button
                type="button"
                onClick={() => setText("")}
                disabled={!text}
                className="rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={preview.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Import {preview.length > 0 ? preview.length : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
