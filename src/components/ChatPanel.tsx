"use client";

import { useEffect, useRef, useState } from "react";

// AI Chat over your knowledge base. Ask a question; the server retrieves the
// most relevant notes/plans and answers with inline [n] citations shown below.

interface Source {
  n: number;
  title: string;
  sourceType: string | null;
  sourceName: string | null;
  url: string | null;
  snippet: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  usedKnowledge?: boolean;
}

const SOURCE_STYLES: Record<string, string> = {
  "deep-plan": "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  telegram: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  note: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [kbCount, setKbCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setKbCount(typeof d.chunks === "number" ? d.chunks : 0))
      .catch(() => setKbCount(null));
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function ask() {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't answer that.");
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources ?? [],
          usedKnowledge: data.usedKnowledge,
        },
      ]);
    } catch {
      setError("Couldn't reach the assistant.");
    } finally {
      setBusy(false);
    }
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
          Ask your knowledge base
        </span>
        {kbCount !== null && (
          <span className="text-xs font-normal text-zinc-400">
            {kbCount} chunk{kbCount === 1 ? "" : "s"} indexed
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          {messages.length === 0 && (
            <p className="text-xs text-zinc-500">
              Ask anything about your notes, plans, and captures — I answer with citations to
              the source. Example: <em>“What did the youth academy plan recommend for pricing?”</em>
              {kbCount === 0 && (
                <span className="mt-1 block text-amber-600 dark:text-amber-400">
                  Your knowledge base is empty — capture a note or run a deep plan first, or I&apos;ll
                  answer from general knowledge.
                </span>
              )}
            </p>
          )}

          {messages.length > 0 && (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : ""}>
                  <div
                    className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                    }`}
                  >
                    {m.content}
                  </div>

                  {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                    <div className="mt-1.5 space-y-1 text-left">
                      {m.sources.map((s) => (
                        <div
                          key={s.n}
                          className="flex items-start gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"
                        >
                          <span className="mt-0.5 font-mono text-zinc-400">[{s.n}]</span>
                          <span
                            className={`shrink-0 rounded px-1 py-0.5 font-medium ${
                              SOURCE_STYLES[s.sourceType ?? ""] ??
                              "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {s.sourceType ?? "note"}
                          </span>
                          <span className="truncate">
                            <span className="font-medium text-zinc-600 dark:text-zinc-300">
                              {s.title}
                            </span>
                            {" — "}
                            {s.snippet}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {m.role === "assistant" && m.usedKnowledge === false && (
                    <p className="mt-1 text-[11px] italic text-zinc-400">
                      Answered from general knowledge — nothing in your notes matched.
                    </p>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                  Searching your notes…
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
              placeholder="Ask about your notes, plans, projects…"
              rows={2}
              disabled={busy}
              className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={ask}
              disabled={!input.trim() || busy}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "…" : "Ask"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
