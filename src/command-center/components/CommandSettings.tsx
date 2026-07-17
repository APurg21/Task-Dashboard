"use client";
import React, { useState } from "react";
import { Overlay } from "./ImpulseCheck";
import type {
  CommandCenterData,
  PulseColor,
  Deal,
  DealHeat,
  WarmLead,
} from "../lib/types";

// ── small style helpers ─────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "rgba(10,4,24,.6)",
  border: "1px solid var(--edge)",
  borderRadius: 8,
  padding: "7px 9px",
  color: "var(--text)",
  fontSize: 12.5,
  width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--dim)",
  marginBottom: 3,
  display: "block",
};
const sectionStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  textTransform: "uppercase",
  letterSpacing: ".12em",
  color: "var(--uv)",
  marginTop: 16,
  marginBottom: 6,
};
const rowStyle: React.CSSProperties = {
  border: "1px solid var(--edge)",
  borderRadius: 10,
  padding: "8px 9px",
  marginBottom: 8,
  background: "rgba(10,4,24,.35)",
};
const rmBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--edge)",
  borderRadius: 8,
  color: "var(--red)",
  fontSize: 12,
  lineHeight: 1,
  padding: "4px 8px",
  cursor: "pointer",
};
const addBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px dashed var(--edge)",
  borderRadius: 8,
  color: "var(--uv)",
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  padding: "6px 10px",
  cursor: "pointer",
};

function newId() {
  return "x" + Math.random().toString(36).slice(2, 8);
}

// generic labelled field wrapper
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const COLOR_OPTS: PulseColor[] = ["green", "yellow", "red"];

export function CommandSettings({
  initial,
  onClose,
  onSave,
}: {
  initial: CommandCenterData;
  onClose: () => void;
  onSave: (next: CommandCenterData) => Promise<void>;
}) {
  const [d, setD] = useState<CommandCenterData>(
    JSON.parse(JSON.stringify(initial)) as CommandCenterData
  );
  const [saving, setSaving] = useState(false);

  // mutate a deep-copied draft and commit
  function edit(fn: (draft: CommandCenterData) => void) {
    setD((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as CommandCenterData;
      fn(next);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(d);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay
      onClose={onClose}
      title="Edit your command center"
      accent="var(--uv)"
      icon={
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </>
      }
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--faint)",
            lineHeight: 1.5,
          }}
        >
          Fill in your real numbers and details — everything here shows on your
          dashboard. Leave a field blank to hide sample text.
        </div>

        {/* 1 · IDENTITY ────────────────────────────────────────── */}
        <div style={sectionStyle}>Identity</div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <Field label="Name">
            <input
              style={inputStyle}
              placeholder="Your name"
              value={d.daily.greetingName}
              onChange={(e) =>
                edit((x) => (x.daily.greetingName = e.target.value))
              }
            />
          </Field>
          <Field label="Date label">
            <input
              style={inputStyle}
              placeholder="Wed · Jul 1"
              value={d.daily.dateLabel}
              onChange={(e) => edit((x) => (x.daily.dateLabel = e.target.value))}
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Field label="Headline">
            <input
              style={inputStyle}
              placeholder="What matters today?"
              value={d.daily.headline}
              onChange={(e) => edit((x) => (x.daily.headline = e.target.value))}
            />
          </Field>
        </div>

        {/* 1b · CHIEF OF STAFF VOICE ────────────────────────────── */}
        <div style={sectionStyle}>Chief of Staff — how it talks to you</div>
        <Field label="Voice / tone (applies to the Chief of Staff, the task-board chat, and Telegram)">
          <textarea
            style={{ ...inputStyle, minHeight: 120, resize: "vertical", lineHeight: 1.5 }}
            placeholder="e.g. Direct, casual, no fluff. Answer first, then a line of why. Give a real opinion — 'yes, worth it' / 'no, better move is…'. Plain English, quick bullets, copy-paste-ready writing. Always end on the next action."
            value={d.chiefStyle ?? ""}
            onChange={(e) => edit((x) => (x.chiefStyle = e.target.value))}
          />
        </Field>

        {/* 2 · MONEY PULSE ─────────────────────────────────────── */}
        <div style={sectionStyle}>Money Pulse</div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <Field label="Color">
            <select
              style={inputStyle}
              value={d.daily.pulses.money.color}
              onChange={(e) =>
                edit(
                  (x) =>
                    (x.daily.pulses.money.color = e.target.value as PulseColor)
                )
              }
            >
              {COLOR_OPTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Spent">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.money.spent}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.money.spent = +e.target.value))
              }
            />
          </Field>
          <Field label="Budget">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.money.budget}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.money.budget = +e.target.value))
              }
            />
          </Field>
          <Field label="Days left">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.money.daysLeft}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.money.daysLeft = +e.target.value))
              }
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Field label="Note">
            <input
              style={inputStyle}
              placeholder="e.g. 84% of budget with 4 days left"
              value={d.daily.pulses.money.note ?? ""}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.money.note = e.target.value))
              }
            />
          </Field>
        </div>
        {d.daily.pulses.money.categories.map((cat, i) => (
          <div key={i} className="flex gap-2 items-end" style={{ marginTop: 8 }}>
            <Field label="Category">
              <input
                style={inputStyle}
                value={cat.label}
                onChange={(e) =>
                  edit(
                    (x) =>
                      (x.daily.pulses.money.categories[i].label = e.target.value)
                  )
                }
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                style={inputStyle}
                value={cat.amount}
                onChange={(e) =>
                  edit(
                    (x) =>
                      (x.daily.pulses.money.categories[i].amount =
                        +e.target.value)
                  )
                }
              />
            </Field>
            <button
              style={rmBtnStyle}
              onClick={() =>
                edit((x) => x.daily.pulses.money.categories.splice(i, 1))
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          style={{ ...addBtnStyle, marginTop: 4 }}
          onClick={() =>
            edit((x) =>
              x.daily.pulses.money.categories.push({ label: "", amount: 0 })
            )
          }
        >
          + Add category
        </button>

        {/* 3 · BODY PULSE ──────────────────────────────────────── */}
        <div style={sectionStyle}>Body Pulse</div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <Field label="Color">
            <select
              style={inputStyle}
              value={d.daily.pulses.body.color}
              onChange={(e) =>
                edit(
                  (x) =>
                    (x.daily.pulses.body.color = e.target.value as PulseColor)
                )
              }
            >
              {COLOR_OPTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Training done">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.body.training.done}
              onChange={(e) =>
                edit(
                  (x) => (x.daily.pulses.body.training.done = +e.target.value)
                )
              }
            />
          </Field>
          <Field label="Training target">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.body.training.target}
              onChange={(e) =>
                edit(
                  (x) => (x.daily.pulses.body.training.target = +e.target.value)
                )
              }
            />
          </Field>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
          <Field label="Next label">
            <input
              style={inputStyle}
              value={d.daily.pulses.body.training.nextLabel ?? ""}
              onChange={(e) =>
                edit(
                  (x) => (x.daily.pulses.body.training.nextLabel = e.target.value)
                )
              }
            />
          </Field>
          <Field label="Sleep hrs">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.body.sleepHrs}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.body.sleepHrs = +e.target.value))
              }
            />
          </Field>
          <Field label="Steps">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.body.steps}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.body.steps = +e.target.value))
              }
            />
          </Field>
          <Field label="Food label">
            <input
              style={inputStyle}
              placeholder="on plan"
              value={d.daily.pulses.body.foodLabel}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.body.foodLabel = e.target.value))
              }
            />
          </Field>
        </div>

        {/* 4 · CLEAN LIFE ──────────────────────────────────────── */}
        <div style={sectionStyle}>Clean Life</div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <Field label="Score">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.clean.score}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.clean.score = +e.target.value))
              }
            />
          </Field>
          <Field label="Out of">
            <input
              type="number"
              style={inputStyle}
              value={d.daily.pulses.clean.outOf}
              onChange={(e) =>
                edit((x) => (x.daily.pulses.clean.outOf = +e.target.value))
              }
            />
          </Field>
        </div>
        {d.daily.pulses.clean.items.map((it, i) => (
          <div key={it.id} className="flex gap-2 items-end" style={{ marginTop: 8 }}>
            <Field label="Label">
              <input
                style={inputStyle}
                value={it.label}
                onChange={(e) =>
                  edit(
                    (x) => (x.daily.pulses.clean.items[i].label = e.target.value)
                  )
                }
              />
            </Field>
            <Field label="Meta">
              <input
                style={inputStyle}
                value={it.meta ?? ""}
                onChange={(e) =>
                  edit(
                    (x) => (x.daily.pulses.clean.items[i].meta = e.target.value)
                  )
                }
              />
            </Field>
            <label
              style={{
                ...labelStyle,
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 8,
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={it.done}
                onChange={(e) =>
                  edit(
                    (x) => (x.daily.pulses.clean.items[i].done = e.target.checked)
                  )
                }
              />
              done
            </label>
            <button
              style={rmBtnStyle}
              onClick={() =>
                edit((x) => x.daily.pulses.clean.items.splice(i, 1))
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          style={{ ...addBtnStyle, marginTop: 4 }}
          onClick={() =>
            edit((x) =>
              x.daily.pulses.clean.items.push({
                id: newId(),
                label: "",
                done: false,
                meta: "",
              })
            )
          }
        >
          + Add item
        </button>

        {/* 5 · MEETINGS ────────────────────────────────────────── */}
        <div style={sectionStyle}>Today&apos;s Meetings</div>
        {d.daily.meetings.map((m, i) => (
          <div key={m.id} style={rowStyle}>
            <div className="flex gap-2 items-start">
              <Field label="Time">
                <input
                  style={inputStyle}
                  placeholder="10:30a"
                  value={m.time}
                  onChange={(e) =>
                    edit((x) => (x.daily.meetings[i].time = e.target.value))
                  }
                />
              </Field>
              <Field label="Title">
                <input
                  style={inputStyle}
                  value={m.title}
                  onChange={(e) =>
                    edit((x) => (x.daily.meetings[i].title = e.target.value))
                  }
                />
              </Field>
              <button
                style={rmBtnStyle}
                onClick={() => edit((x) => x.daily.meetings.splice(i, 1))}
              >
                ✕
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <Field label="Where">
                <input
                  style={inputStyle}
                  value={m.where ?? ""}
                  onChange={(e) =>
                    edit((x) => (x.daily.meetings[i].where = e.target.value))
                  }
                />
              </Field>
            </div>
          </div>
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            edit((x) =>
              x.daily.meetings.push({
                id: newId(),
                time: "",
                title: "",
                where: "",
              })
            )
          }
        >
          + Add meeting
        </button>

        {/* 6 · EMAILS ──────────────────────────────────────────── */}
        <div style={sectionStyle}>Emails That Matter</div>
        {d.daily.emails.map((em, i) => (
          <div key={em.id} style={rowStyle}>
            <div className="flex gap-2 items-start">
              <Field label="Subject">
                <input
                  style={inputStyle}
                  value={em.subject}
                  onChange={(e) =>
                    edit((x) => (x.daily.emails[i].subject = e.target.value))
                  }
                />
              </Field>
              <button
                style={rmBtnStyle}
                onClick={() => edit((x) => x.daily.emails.splice(i, 1))}
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
              <Field label="From">
                <input
                  style={inputStyle}
                  value={em.from}
                  onChange={(e) =>
                    edit((x) => (x.daily.emails[i].from = e.target.value))
                  }
                />
              </Field>
              <Field label="Age (days)">
                <input
                  type="number"
                  style={inputStyle}
                  value={em.ageDays}
                  onChange={(e) =>
                    edit((x) => (x.daily.emails[i].ageDays = +e.target.value))
                  }
                />
              </Field>
              <Field label="Action">
                <select
                  style={inputStyle}
                  value={em.action}
                  onChange={(e) =>
                    edit(
                      (x) =>
                        (x.daily.emails[i].action = e.target
                          .value as EmailAction)
                    )
                  }
                >
                  {(["reply", "soon", "fyi"] as const).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            edit((x) =>
              x.daily.emails.push({
                id: newId(),
                subject: "",
                from: "",
                ageDays: 0,
                action: "reply",
              })
            )
          }
        >
          + Add email
        </button>

        {/* 7 · SALES PIPELINE ──────────────────────────────────── */}
        <div style={sectionStyle}>Sales Pipeline</div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <Field label="Projected">
            <input
              type="number"
              style={inputStyle}
              value={d.pipeline.projected}
              onChange={(e) =>
                edit((x) => (x.pipeline.projected = +e.target.value))
              }
            />
          </Field>
          <Field label="Weighted">
            <input
              type="number"
              style={inputStyle}
              value={d.pipeline.weighted}
              onChange={(e) =>
                edit((x) => (x.pipeline.weighted = +e.target.value))
              }
            />
          </Field>
          <Field label="Stalled count">
            <input
              type="number"
              style={inputStyle}
              value={d.pipeline.stalledCount}
              onChange={(e) =>
                edit((x) => (x.pipeline.stalledCount = +e.target.value))
              }
            />
          </Field>
        </div>
        <DealList
          heading="Best deals"
          deals={d.pipeline.best}
          onEdit={(fn) => edit((x) => fn(x.pipeline.best))}
        />
        <DealList
          heading="Stalled deals"
          deals={d.pipeline.stalled}
          onEdit={(fn) => edit((x) => fn(x.pipeline.stalled))}
        />

        {/* 8 · FOLLOW-UP RADAR ─────────────────────────────────── */}
        <div style={sectionStyle}>Follow-Up Radar</div>
        {d.radar.map((r, i) => (
          <div key={r.id} style={rowStyle}>
            <div className="flex gap-2 items-start">
              <Field label="Name">
                <input
                  style={inputStyle}
                  value={r.name}
                  onChange={(e) =>
                    edit((x) => (x.radar[i].name = e.target.value))
                  }
                />
              </Field>
              <button
                style={rmBtnStyle}
                onClick={() => edit((x) => x.radar.splice(i, 1))}
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
              <Field label="Channel">
                <select
                  style={inputStyle}
                  value={r.channel}
                  onChange={(e) =>
                    edit(
                      (x) =>
                        (x.radar[i].channel = e.target.value as WarmLead["channel"])
                    )
                  }
                >
                  {(["email", "call", "text"] as const).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Last touch (days)">
                <input
                  type="number"
                  style={inputStyle}
                  value={r.lastTouchDays}
                  onChange={(e) =>
                    edit((x) => (x.radar[i].lastTouchDays = +e.target.value))
                  }
                />
              </Field>
              <Field label="Value">
                <input
                  type="number"
                  style={inputStyle}
                  value={r.value ?? 0}
                  onChange={(e) =>
                    edit((x) => (x.radar[i].value = +e.target.value))
                  }
                />
              </Field>
            </div>
            <div style={{ marginTop: 8 }}>
              <Field label="Reason">
                <input
                  style={inputStyle}
                  value={r.reason ?? ""}
                  onChange={(e) =>
                    edit((x) => (x.radar[i].reason = e.target.value))
                  }
                />
              </Field>
            </div>
          </div>
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            edit((x) =>
              x.radar.push({
                id: newId(),
                name: "",
                channel: "email",
                lastTouchDays: 0,
                value: 0,
                reason: "",
              })
            )
          }
        >
          + Add lead
        </button>

        {/* 9 · WEEKLY STORY ────────────────────────────────────── */}
        <div style={sectionStyle}>Weekly Story</div>
        <Field label="What happened">
          <textarea
            style={{ ...inputStyle, minHeight: 54, resize: "vertical" }}
            value={d.story.whatHappened}
            onChange={(e) =>
              edit((x) => (x.story.whatHappened = e.target.value))
            }
          />
        </Field>
        <div style={{ marginTop: 8 }}>
          <Field label="Why">
            <textarea
              style={{ ...inputStyle, minHeight: 54, resize: "vertical" }}
              value={d.story.why}
              onChange={(e) => edit((x) => (x.story.why = e.target.value))}
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Field label="What's next">
            <textarea
              style={{ ...inputStyle, minHeight: 54, resize: "vertical" }}
              value={d.story.whatsNext}
              onChange={(e) =>
                edit((x) => (x.story.whatsNext = e.target.value))
              }
            />
          </Field>
        </div>

        {/* 10 · YOUR VOICE ─────────────────────────────────────── */}
        <div style={sectionStyle}>Your Voice</div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <Field label="Tone">
            <input
              style={inputStyle}
              placeholder="warm-direct"
              value={d.style.tone}
              onChange={(e) => edit((x) => (x.style.tone = e.target.value))}
            />
          </Field>
          <Field label="Avg sentence length">
            <input
              type="number"
              style={inputStyle}
              value={d.style.avgSentenceLen}
              onChange={(e) =>
                edit((x) => (x.style.avgSentenceLen = +e.target.value))
              }
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Field label="Greetings (comma separated)">
            <input
              style={inputStyle}
              value={d.style.greetings.join(", ")}
              onChange={(e) =>
                edit((x) => (x.style.greetings = splitCsv(e.target.value)))
              }
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Field label="Sign-offs (comma separated)">
            <input
              style={inputStyle}
              value={d.style.signoffs.join(", ")}
              onChange={(e) =>
                edit((x) => (x.style.signoffs = splitCsv(e.target.value)))
              }
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Field label="Phrases (comma separated)">
            <input
              style={inputStyle}
              value={d.style.phrases.join(", ")}
              onChange={(e) =>
                edit((x) => (x.style.phrases = splitCsv(e.target.value)))
              }
            />
          </Field>
        </div>

        {/* 11 · TRAVEL ─────────────────────────────────────────── */}
        <div style={sectionStyle}>Travel</div>
        <label
          style={{
            ...labelStyle,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={d.travel.active}
            onChange={(e) => edit((x) => (x.travel.active = e.target.checked))}
          />
          Currently traveling
        </label>
        <div className="flex gap-2" style={{ flexWrap: "wrap", marginTop: 4 }}>
          <Field label="City">
            <input
              style={inputStyle}
              value={d.travel.city}
              onChange={(e) => edit((x) => (x.travel.city = e.target.value))}
            />
          </Field>
          <Field label="Dates">
            <input
              style={inputStyle}
              value={d.travel.dates}
              onChange={(e) => edit((x) => (x.travel.dates = e.target.value))}
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Field label="City notes">
            <textarea
              style={{ ...inputStyle, minHeight: 48, resize: "vertical" }}
              value={d.travel.cityNotes}
              onChange={(e) =>
                edit((x) => (x.travel.cityNotes = e.target.value))
              }
            />
          </Field>
        </div>

        {/* travel · logistics */}
        <div
          style={{
            ...sectionStyle,
            marginTop: 10,
            color: "var(--dim)",
            fontSize: 9,
          }}
        >
          Logistics
        </div>
        {d.travel.logistics.map((lg, i) => (
          <div key={i} className="flex gap-2 items-end" style={{ marginBottom: 8 }}>
            <Field label="Icon">
              <select
                style={inputStyle}
                value={lg.icon}
                onChange={(e) =>
                  edit(
                    (x) =>
                      (x.travel.logistics[i].icon = e.target
                        .value as TravelIcon)
                  )
                }
              >
                {(["flight", "hotel", "car"] as const).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input
                style={inputStyle}
                value={lg.title}
                onChange={(e) =>
                  edit((x) => (x.travel.logistics[i].title = e.target.value))
                }
              />
            </Field>
            <Field label="Sub">
              <input
                style={inputStyle}
                value={lg.sub}
                onChange={(e) =>
                  edit((x) => (x.travel.logistics[i].sub = e.target.value))
                }
              />
            </Field>
            <button
              style={rmBtnStyle}
              onClick={() => edit((x) => x.travel.logistics.splice(i, 1))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          style={{ ...addBtnStyle, marginBottom: 4 }}
          onClick={() =>
            edit((x) =>
              x.travel.logistics.push({ icon: "flight", title: "", sub: "" })
            )
          }
        >
          + Add logistics
        </button>

        {/* travel · people */}
        <div
          style={{
            ...sectionStyle,
            marginTop: 10,
            color: "var(--dim)",
            fontSize: 9,
          }}
        >
          People
        </div>
        {d.travel.people.map((p, i) => (
          <div key={i} className="flex gap-2 items-end" style={{ marginBottom: 8 }}>
            <Field label="Name">
              <input
                style={inputStyle}
                value={p.name}
                onChange={(e) =>
                  edit((x) => (x.travel.people[i].name = e.target.value))
                }
              />
            </Field>
            <Field label="Note">
              <input
                style={inputStyle}
                value={p.note}
                onChange={(e) =>
                  edit((x) => (x.travel.people[i].note = e.target.value))
                }
              />
            </Field>
            <button
              style={rmBtnStyle}
              onClick={() => edit((x) => x.travel.people.splice(i, 1))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          style={{ ...addBtnStyle, marginBottom: 4 }}
          onClick={() =>
            edit((x) => x.travel.people.push({ name: "", note: "" }))
          }
        >
          + Add person
        </button>

        {/* travel · spots */}
        <div
          style={{
            ...sectionStyle,
            marginTop: 10,
            color: "var(--dim)",
            fontSize: 9,
          }}
        >
          Spots
        </div>
        {d.travel.spots.map((s, i) => (
          <div key={i} className="flex gap-2 items-end" style={{ marginBottom: 8 }}>
            <Field label="Name">
              <input
                style={inputStyle}
                value={s.name}
                onChange={(e) =>
                  edit((x) => (x.travel.spots[i].name = e.target.value))
                }
              />
            </Field>
            <Field label="Kind">
              <select
                style={inputStyle}
                value={s.kind}
                onChange={(e) =>
                  edit(
                    (x) =>
                      (x.travel.spots[i].kind = e.target.value as SpotKind)
                  )
                }
              >
                {(["coffee", "gym", "food", "prospect"] as const).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Meta">
              <input
                style={inputStyle}
                value={s.meta}
                onChange={(e) =>
                  edit((x) => (x.travel.spots[i].meta = e.target.value))
                }
              />
            </Field>
            <button
              style={rmBtnStyle}
              onClick={() => edit((x) => x.travel.spots.splice(i, 1))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            edit((x) =>
              x.travel.spots.push({ name: "", kind: "coffee", meta: "" })
            )
          }
        >
          + Add spot
        </button>

        {/* 12 · IMPROVEMENT PLAN ───────────────────────────────── */}
        <div style={sectionStyle}>Improvement Plan</div>
        {d.improvement.map((im, i) => (
          <div key={i} style={rowStyle}>
            <div className="flex gap-2 items-start">
              <Field label="Axis">
                <select
                  style={inputStyle}
                  value={im.axis}
                  onChange={(e) =>
                    edit(
                      (x) =>
                        (x.improvement[i].axis = e.target.value as ImproveAxis)
                    )
                  }
                >
                  {(["career", "body", "money", "social"] as const).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Move">
                <input
                  style={inputStyle}
                  value={im.move}
                  onChange={(e) =>
                    edit((x) => (x.improvement[i].move = e.target.value))
                  }
                />
              </Field>
              <button
                style={rmBtnStyle}
                onClick={() => edit((x) => x.improvement.splice(i, 1))}
              >
                ✕
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <Field label="Progress">
                <input
                  style={inputStyle}
                  value={im.progress ?? ""}
                  onChange={(e) =>
                    edit((x) => (x.improvement[i].progress = e.target.value))
                  }
                />
              </Field>
            </div>
          </div>
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            edit((x) =>
              x.improvement.push({ axis: "career", move: "", progress: "" })
            )
          }
        >
          + Add move
        </button>

        {/* 13 · WEEK PLAN ──────────────────────────────────────── */}
        <div style={sectionStyle}>Week Plan</div>
        <Field label="Big rock">
          <input
            style={inputStyle}
            value={d.weekPlan.bigRock}
            onChange={(e) => edit((x) => (x.weekPlan.bigRock = e.target.value))}
          />
        </Field>
        <div className="flex gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
          <Field label="Body">
            <input
              style={inputStyle}
              value={d.weekPlan.body}
              onChange={(e) => edit((x) => (x.weekPlan.body = e.target.value))}
            />
          </Field>
          <Field label="Money">
            <input
              style={inputStyle}
              value={d.weekPlan.money}
              onChange={(e) => edit((x) => (x.weekPlan.money = e.target.value))}
            />
          </Field>
          <Field label="Social">
            <input
              style={inputStyle}
              value={d.weekPlan.social}
              onChange={(e) =>
                edit((x) => (x.weekPlan.social = e.target.value))
              }
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Field label="Work blocks (one per line)">
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              value={d.weekPlan.workBlocks.join("\n")}
              onChange={(e) =>
                edit(
                  (x) =>
                    (x.weekPlan.workBlocks = e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean))
                )
              }
            />
          </Field>
        </div>

        {/* actions ─────────────────────────────────────────────── */}
        <button
          onClick={save}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: 20,
            padding: 12,
            border: 0,
            borderRadius: 12,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            letterSpacing: ".04em",
            fontSize: 13,
            color: "#fff",
            background: "linear-gradient(160deg,var(--violet),#5b54c9)",
            boxShadow: "var(--g-vi)",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={onClose}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: 8,
            padding: 10,
            border: "1px solid var(--edge)",
            borderRadius: 12,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            letterSpacing: ".03em",
            fontSize: 12.5,
            color: "var(--dim)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </Overlay>
  );
}

// ── local type aliases (kept in-file, derived from the shared types) ──
type EmailAction = "reply" | "soon" | "fyi";
type TravelIcon = "flight" | "hotel" | "car";
type SpotKind = "coffee" | "gym" | "food" | "prospect";
type ImproveAxis = "career" | "body" | "money" | "social";

function splitCsv(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── reusable deal-list editor (used for best[] and stalled[]) ────
function DealList({
  heading,
  deals,
  onEdit,
}: {
  heading: string;
  deals: Deal[];
  onEdit: (fn: (list: Deal[]) => void) => void;
}) {
  return (
    <>
      <div
        style={{
          ...sectionStyle,
          marginTop: 10,
          color: "var(--dim)",
          fontSize: 9,
        }}
      >
        {heading}
      </div>
      {deals.map((dl, i) => (
        <div key={dl.id} style={rowStyle}>
          <div className="flex gap-2 items-start">
            <Field label="Name">
              <input
                style={inputStyle}
                value={dl.name}
                onChange={(e) => onEdit((l) => (l[i].name = e.target.value))}
              />
            </Field>
            <button
              style={rmBtnStyle}
              onClick={() => onEdit((l) => l.splice(i, 1))}
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <Field label="Amount">
              <input
                type="number"
                style={inputStyle}
                value={dl.amount}
                onChange={(e) => onEdit((l) => (l[i].amount = +e.target.value))}
              />
            </Field>
            <Field label="Stage">
              <input
                style={inputStyle}
                value={dl.stage}
                onChange={(e) => onEdit((l) => (l[i].stage = e.target.value))}
              />
            </Field>
            <Field label="Probability (0..1)">
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                style={inputStyle}
                value={dl.probability}
                onChange={(e) =>
                  onEdit((l) => (l[i].probability = +e.target.value))
                }
              />
            </Field>
          </div>
          <div className="flex gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <Field label="Heat">
              <select
                style={inputStyle}
                value={dl.heat}
                onChange={(e) =>
                  onEdit((l) => (l[i].heat = e.target.value as DealHeat))
                }
              >
                {(["hot", "warm", "cold", "stalled"] as const).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Age (days)">
              <input
                type="number"
                style={inputStyle}
                value={dl.ageDays}
                onChange={(e) => onEdit((l) => (l[i].ageDays = +e.target.value))}
              />
            </Field>
            <Field label="Contact">
              <input
                style={inputStyle}
                value={dl.contact ?? ""}
                onChange={(e) => onEdit((l) => (l[i].contact = e.target.value))}
              />
            </Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="Say next">
              <input
                style={inputStyle}
                value={dl.sayNext ?? ""}
                onChange={(e) => onEdit((l) => (l[i].sayNext = e.target.value))}
              />
            </Field>
          </div>
        </div>
      ))}
      <button
        style={addBtnStyle}
        onClick={() =>
          onEdit((l) =>
            l.push({
              id: newId(),
              name: "",
              amount: 0,
              stage: "",
              probability: 0,
              heat: "warm",
              ageDays: 0,
              contact: "",
              sayNext: "",
            })
          )
        }
      >
        + Add deal
      </button>
    </>
  );
}
