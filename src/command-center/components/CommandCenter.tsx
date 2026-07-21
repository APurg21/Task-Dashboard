"use client";
import React, { useEffect, useRef, useState } from "react";
import type { CommandCenterData } from "../lib/types";
import { Panel } from "./ui";
import { DailyCommandCenter } from "./DailyCommandCenter";
import { ObsidianKnowledge } from "./ObsidianKnowledge";
import { ImpulseCheck } from "./ImpulseCheck";
import { VoiceToTask } from "./VoiceToTask";
import { WhatAmIMissing } from "./WhatAmIMissing";
import { SundayReset } from "./SundayReset";
import { CommandSettings } from "./CommandSettings";
import { TaskListPanel, type ListTask } from "./TaskListPanel";
import type { BlindSpot } from "../lib/types";

type ViewId = "today" | "work" | "life" | "travel" | "know";
type ModalId = "voice" | "missing" | "impulse" | "sunday" | null;

const TITLES: Record<ViewId, React.ReactNode> = {
  today: <>What matters <span>today?</span></>,
  work: <>Sales <span>brain.</span></>,
  life: <>Your <span>life.</span></>,
  travel: <>On the <span>road.</span></>,
  know: <>Your <span>brain,</span> searchable.</>,
};

const NAV: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  { id: "today", label: "Today", icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></> },
  { id: "work", label: "Work · Sales", icon: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></> },
  { id: "life", label: "Life", icon: <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /> },
  { id: "travel", label: "Travel mode", icon: <path d="M2 16l20-5-9-3-2-6-2 8-5 2 3 3z" /> },
  { id: "know", label: "Obsidian brain", icon: <><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2V5z" /><path d="M8 3v18" /></> },
];

const ACTIONS: { id: Exclude<ModalId, null>; label: string; cls: string; icon: React.ReactNode }[] = [
  { id: "voice", label: "Voice", cls: "mg", icon: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></> },
  { id: "missing", label: "What am I missing?", cls: "am", icon: <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /> },
  { id: "impulse", label: "Impulse check", cls: "cy", icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
  { id: "sunday", label: "Sunday reset", cls: "uv", icon: <path d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5" /> },
];

export function CommandCenter({
  data,
  workList,
  lifeList,
  onToggleTask,
  onSaveProfile,
  blindspots,
  onCurate,
  curating,
  curateWhy,
  onCapture,
}: {
  data: CommandCenterData;
  // Full open-task lists for the Work/Life tabs (live from Redis). When absent
  // (mock-only usage), the tabs fall back to the ComingSoon placeholder.
  workList?: ListTask[];
  lifeList?: ListTask[];
  onToggleTask?: (id: string, done: boolean) => void;
  onSaveProfile?: (next: CommandCenterData) => Promise<void>;
  blindspots?: BlindSpot[];
  onCurate?: () => void;
  curating?: boolean;
  curateWhy?: string;
  onCapture?: (text: string) => Promise<{ title: string; context: string; priority: string }>;
  ready?: boolean;
}) {
  const [view, setView] = useState<ViewId>("today");
  const [modal, setModal] = useState<ModalId>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModal(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="cosmic cc-root">
      <style>{SHELL_CSS}</style>
      <div className="cc-nebula" />
      <Starfield />
      <div className="cc-grain" />

      <div className="cc-wrap">
        <div className="cc-topline">
          <div className="cc-brand">
            <span className="cc-gem">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 8v5" /></svg>
            </span>
            COSMIC COMMAND · CHIEF OF STAFF
          </div>
          <a href="/tasks" className="cc-taskslink">Task board →</a>
        </div>

        <div className="cc-app">
          <nav className="cc-rail">
            {NAV.map((n) => (
              <button key={n.id} className={`cc-nav${view === n.id ? " on" : ""}`} onClick={() => setView(n.id)} aria-label={n.label} aria-current={view === n.id}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{n.icon}</svg>
                <span className="cc-lbl">{n.label}</span>
              </button>
            ))}
            <div className="cc-rail-sp" />
            <div className="cc-av">A</div>
          </nav>

          <main className="cc-main">
            <header className="cc-hdr">
              <div className="cc-hdr-row">
                <div>
                  <h1 className="cc-hi">{TITLES[view]}</h1>
                  <div className="cc-date"><b>{data.daily.dateLabel}</b> · {data.daily.meetings.length} meetings · {data.radar.length} warming leads · Richmond 94°</div>
                </div>
                <div className="cc-actions">
                  {ACTIONS.map((a) => (
                    <button key={a.id} className={`cc-act ${a.cls}`} onClick={() => setModal(a.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{a.icon}</svg>
                      {a.label}
                    </button>
                  ))}
                  {onSaveProfile && (
                    <button className="cc-act uv" onClick={() => setEditOpen(true)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </header>

            {view === "today" && (
              <section className="cc-view">
                <DailyCommandCenter
                  data={data.daily}
                  onToggle={onToggleTask}
                  onCurate={onCurate}
                  curating={curating}
                  curateWhy={curateWhy}
                />
              </section>
            )}

            {view === "work" && (
              <section className="cc-view">
                {workList ? (
                  <TaskListPanel title="All open · Work" accent="uv" tasks={workList} onToggle={onToggleTask} />
                ) : (
                  <ComingSoon
                    title="Work · Sales"
                    line="Your pipeline, follow-up radar, weekly story, and in-your-voice drafts live here — once you connect a real source (Pipedrive or a sales sheet). Until then it's a preview, kept out of your way."
                  />
                )}
              </section>
            )}

            {view === "life" && (
              <section className="cc-view">
                {lifeList ? (
                  <TaskListPanel title="All open · Life" accent="magenta" tasks={lifeList} onToggle={onToggleTask} />
                ) : (
                  <ComingSoon
                    title="Life"
                    line="Money & body pulses, clean-life checklist, and your self-improvement plan turn on when you connect your numbers (bank/health) or fill them in Edit. Hidden for now so the dashboard isn't showing you a made-up life."
                  />
                )}
              </section>
            )}

            {view === "travel" && (
              <section className="cc-view">
                <ComingSoon
                  title="Travel mode"
                  line="Flips on when you've got a trip — flights, hotel, prospects to hit, and local spots. Nothing to show until then."
                />
              </section>
            )}

            {view === "know" && (
              <section className="cc-view"><ObsidianKnowledge /></section>
            )}
          </main>
        </div>
      </div>

      {modal === "voice" && <VoiceToTask onClose={() => setModal(null)} onCapture={onCapture} />}
      {modal === "missing" && <WhatAmIMissing onClose={() => setModal(null)} spots={blindspots} />}
      {modal === "impulse" && <ImpulseCheck onClose={() => setModal(null)} moneyPulseColor={data.daily.pulses.money.color} />}
      {modal === "sunday" && <SundayReset onClose={() => setModal(null)} plan={data.weekPlan} />}
      {editOpen && onSaveProfile && (
        <CommandSettings initial={data} onClose={() => setEditOpen(false)} onSave={onSaveProfile} />
      )}
    </div>
  );
}

// Placeholder for modules that aren't connected to real data yet — so the
// cockpit never shows a made-up life. Comes back the moment a real source is wired.
function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <Panel accent="violet" title={title} right="not connected yet">
      <div style={{ padding: "28px 22px", textAlign: "center" }}>
        <div style={{ fontSize: 22, marginBottom: 10 }}>✨</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: ".02em", marginBottom: 8 }}>
          Coming online soon
        </div>
        <p style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>{line}</p>
      </div>
    </Panel>
  );
}

// Twinkling starfield backdrop (respects prefers-reduced-motion).
function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext("2d");
    if (!x) return;
    const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
    let w = 0, h = 0, stars: { x: number; y: number; r: number; p: number; s: number; c: string }[] = [];
    let raf = 0;
    const size = () => {
      w = c.width = innerWidth; h = c.height = innerHeight; stars = [];
      const n = Math.min(150, Math.floor((w * h) / 10000));
      for (let i = 0; i < n; i++) stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.2, p: Math.random() * 6.3, s: Math.random() * 0.02 + 0.005, c: Math.random() < 0.13 ? "182,255,60" : Math.random() < 0.3 ? "53,231,255" : "255,255,255" });
    };
    const draw = (t: number) => {
      x.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = reduce ? 0.7 : Math.sin(s.p + t * s.s) * 0.5 + 0.5;
        x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7);
        x.fillStyle = `rgba(${s.c},${0.25 + tw * 0.7})`; x.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    size(); addEventListener("resize", size); raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, []);
  return <canvas ref={ref} className="cc-stars" />;
}

const SHELL_CSS = `
.cc-root{position:relative;min-height:100vh;background:#040109;overflow-x:hidden}
.cc-stars{position:fixed;inset:0;z-index:0;pointer-events:none}
.cc-nebula{position:fixed;inset:0;z-index:0;pointer-events:none;background:
  radial-gradient(58% 42% at 80% 6%,rgba(157,92,255,.28),transparent 60%),
  radial-gradient(52% 38% at 10% 22%,rgba(255,61,190,.14),transparent 60%),
  radial-gradient(70% 55% at 50% 110%,rgba(53,231,255,.14),transparent 55%),
  linear-gradient(180deg,#0A0418,#050110 62%)}
.cc-grain{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.045;background-image:radial-gradient(circle at 1px 1px,#fff 1px,transparent 0);background-size:3px 3px}
.cc-wrap{position:relative;z-index:1;max-width:1400px;margin:0 auto;padding:16px 16px 24px}
.cc-topline{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.cc-brand{display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:700;letter-spacing:.02em;font-size:13px;color:var(--dim)}
.cc-gem{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:conic-gradient(from 200deg,var(--violet),var(--magenta),var(--cyan),var(--uv),var(--violet));box-shadow:var(--g-vi)}
.cc-gem svg{width:15px;height:15px}
.cc-taskslink{font-family:var(--font-mono);font-size:11px;letter-spacing:.04em;color:var(--dim);background:rgba(10,4,24,.6);border:1px solid var(--edge);border-radius:999px;padding:6px 13px;transition:.15s;text-decoration:none}
.cc-taskslink:hover{border-color:var(--edge-hot);color:var(--uv);box-shadow:var(--g-uv)}
.cc-app{display:grid;grid-template-columns:66px 1fr;gap:14px}
.cc-rail{background:rgba(9,4,22,.6);border:1px solid var(--edge);border-radius:20px;backdrop-filter:blur(12px);display:flex;flex-direction:column;align-items:center;gap:5px;padding:14px 0}
.cc-nav{width:46px;height:46px;border:0;background:transparent;border-radius:13px;color:var(--faint);display:grid;place-items:center;position:relative;transition:.15s;cursor:pointer}
.cc-nav svg{width:21px;height:21px}
.cc-nav:hover{background:rgba(157,92,255,.1);color:var(--dim)}
.cc-nav.on{background:rgba(182,255,60,.12);color:var(--uv);box-shadow:var(--g-uv)}
.cc-lbl{position:absolute;left:52px;background:var(--void2);border:1px solid var(--edge);padding:4px 9px;border-radius:8px;font-size:11px;white-space:nowrap;opacity:0;pointer-events:none;transition:.15s;z-index:20;font-family:var(--font-mono)}
.cc-nav:hover .cc-lbl{opacity:1}
.cc-rail-sp{flex:1}
.cc-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(140deg,#37405a,#232a3b);display:grid;place-items:center;font-weight:600;color:var(--dim);border:1px solid var(--edge)}
.cc-main{min-width:0}
.cc-hdr{position:relative;border:1px solid var(--edge);border-radius:20px;overflow:hidden;backdrop-filter:blur(14px);background:linear-gradient(120deg,rgba(30,14,60,.62),rgba(12,6,34,.62));padding:16px 20px;margin-bottom:14px}
.cc-hdr::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 3px,rgba(182,255,60,.025) 3px 4px);pointer-events:none}
.cc-hdr-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;position:relative}
.cc-hi{font-family:var(--font-display);font-weight:700;font-size:clamp(22px,3vw,34px);letter-spacing:.03em;margin:0;text-shadow:var(--g-uv)}
.cc-hi span{color:var(--uv)}
.cc-date{font-family:var(--font-mono);font-size:11.5px;color:var(--dim);margin-top:6px}
.cc-date b{color:var(--uv);font-weight:500}
.cc-actions{display:flex;gap:8px;flex-wrap:wrap}
.cc-act{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-mono);font-size:11px;letter-spacing:.03em;color:var(--dim);background:rgba(10,4,24,.6);border:1px solid var(--edge);border-radius:11px;padding:8px 11px;transition:.15s;cursor:pointer}
.cc-act:hover{border-color:var(--edge-hot);color:var(--text)}
.cc-act svg{width:14px;height:14px}
.cc-act.uv{color:var(--uv);border-color:rgba(182,255,60,.35)}
.cc-act.mg{color:var(--magenta);border-color:rgba(255,61,190,.35)}
.cc-act.am{color:var(--amber);border-color:rgba(255,194,77,.35)}
.cc-act.cy{color:var(--cyan);border-color:rgba(53,231,255,.35)}
.cc-view{animation:cc-fade .3s ease}
@keyframes cc-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(max-width:1080px){.cc-app{grid-template-columns:56px 1fr}}
@media(max-width:820px){.cc-view .grid{grid-template-columns:1fr !important}}
@media(max-width:620px){
  .cc-app{grid-template-columns:1fr}
  .cc-rail{flex-direction:row;justify-content:space-around;padding:8px;position:sticky;bottom:8px;z-index:30}
  .cc-rail-sp,.cc-av{display:none}
  .cc-actions{width:100%}
}
@media(prefers-reduced-motion:reduce){.cc-view{animation:none}}
`;
