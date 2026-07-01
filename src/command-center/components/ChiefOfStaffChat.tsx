"use client";
import React, { useState, useRef, useEffect } from "react";
import { Panel } from "./ui";
import { adapters } from "../lib/adapters";
import type { ChatMessage } from "../lib/types";

const SUGGESTIONS = [
  "Who do I need to follow up with?",
  "What changed since yesterday?",
  "What should I work on next?",
  "Draft this week's report",
];

export function ChiefOfStaffChat({ ctx }: { ctx?: unknown }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([
    { role: "ai", text: "Morning, Alex. You've got 3 high-value leads with no next step and the Chamber email is aging. Want me to line up your day?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight); }, [msgs]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMsgs(m => [...m, { role: "me", text }]);
    setInput(""); setBusy(true);
    try {
      const ans = await adapters.ai.ask(text, ctx);   // ← real Claude call once wired
      setMsgs(m => [...m, { role: "ai", text: ans.text }]);
    } catch {
      setMsgs(m => [...m, { role: "ai", text: "Chief of Staff isn't wired yet — set ANTHROPIC_API_KEY and implement adapters.ai.ask()." }]);
    } finally { setBusy(false); }
  }

  return (
    <Panel accent="violet" title="Chief of Staff" right="ask anything" className="flex flex-col h-full">
      <div ref={bodyRef} className="flex flex-col gap-2.5 overflow-auto p-3" style={{ minHeight: 280, maxHeight: 440 }}>
        {msgs.map((m, i) => (
          <div key={i} className="rounded-2xl" style={{
            maxWidth: "88%", padding: "10px 13px", fontSize: 12.5, lineHeight: 1.5,
            alignSelf: m.role === "ai" ? "flex-start" : "flex-end",
            background: m.role === "ai" ? "rgba(157,92,255,.13)" : "rgba(53,231,255,.12)",
            border: `1px solid ${m.role === "ai" ? "var(--edge)" : "rgba(53,231,255,.3)"}`,
            borderBottomLeftRadius: m.role === "ai" ? 5 : undefined,
            borderBottomRightRadius: m.role === "me" ? 5 : undefined,
          }}>{m.text}</div>
        ))}
        {busy && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", paddingLeft: 4 }}>thinking…</div>}
      </div>
      <div className="flex flex-wrap gap-2 px-3 pb-2.5">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)} className="rounded-full"
            style={{ fontSize: 11, color: "var(--dim)", background: "rgba(10,4,24,.6)", border: "1px solid var(--edge)", padding: "6px 11px" }}>{s}</button>
        ))}
      </div>
      <div className="flex gap-2 p-3" style={{ borderTop: "1px solid var(--edge)" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="Ask your chief of staff…" className="flex-1 rounded-xl"
          style={{ background: "rgba(10,4,24,.6)", border: "1px solid var(--edge)", padding: "10px 12px", color: "var(--text)", fontSize: 12.5 }} />
        <button onClick={() => send(input)} className="grid place-items-center rounded-xl"
          style={{ width: 40, border: 0, background: "linear-gradient(160deg,var(--violet),#5b54c9)", boxShadow: "var(--g-vi)" }} aria-label="Send">
          <svg width="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
    </Panel>
  );
}
