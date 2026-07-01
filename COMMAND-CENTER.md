# Cosmic Command Center — how it works

The one-line model: **Telegram is the mouth. The task board is the memory. The command page is the part that taps you on the shoulder.**

You brain-dump → the task board (Redis) tracks everything in the background → the command page elevates what matters.

---

## Routes

| URL | What it is |
|-----|-----------|
| `/` | **Command Center** (home) — the blacklight cockpit you live in |
| `/tasks` | The original task board — kanban/list/projects, capture, import, deep planner (the background engine) |
| `/command` | Alias of the command center |

Cross-linked: "Task board →" in the command-center header, "⌘ Command Center" on the task board.

---

## Command Center — the 5 views (left rail)

- **Today** — Top-3 Work + Today-Life (LIVE from your board), pulses, meetings/emails, Chief of Staff chat
- **Work · Sales** — pipeline, follow-up radar, weekly story, writing-in-your-voice draft
- **Life** — self-improvement plan, clean-life checklist, money + body pulse detail
- **Travel** — logistics, city notes, people + local spots
- **Knowledge** — search your notes (LIVE, full-text over everything you've captured)

## Header actions (top-right)

- **Voice** → dictate/type a note; it's classified and created on the real board
- **What am I missing?** → computed from the real board (high-priority, stalled >7d, untagged)
- **Impulse check** → 3 questions before you spend; tightens if Money Pulse is red
- **Sunday reset** → your week plan
- **Edit** → open the settings form (see below)

## Today view specifics

- **Top-3 Work / Today-Life** pull from your open board tasks (work → Top-3, personal → Life), sorted by priority + recency.
- **✦ curate** → the Chief of Staff (Sonnet 5, on demand) re-ranks them into what actually moves the needle today, with a one-line why.
- **Check a box** → writes `done` back to the board (Redis). Two-way.

---

## What's LIVE vs EDITABLE vs MOCK

- **LIVE (real data, now):** Today's Top-3/Life (your tasks), Knowledge search, Chief of Staff chat, What-am-I-missing, Voice→Task, curate.
- **EDITABLE (your saved profile):** Money, Body, Clean Life, Pipeline, Radar, Weekly Story, Your Voice, Travel, Improvement, Week Plan. Edit them in the form; saved server-side (Redis `cc:profile`) so it's the same on any device.
- **MOCK until wired:** the numbers behind pipeline/money/body come from your profile, not a real Pipedrive/bank/health feed yet.

## Editing everything

**Edit** button → a form covering every non-live module. Fill in your real numbers; hit Save. It's your fill-in prompt and your control panel in one.

## Chief of Staff voice

**Edit → "Chief of Staff — how it talks to you"** is a free-text directive stored on your profile and injected into the prompt. It shapes **every** chat surface: the command-center chat, the task-board chat, and Telegram. Current setting: direct, answer-first, operator lens, no fluff, ends on the next action.

---

## Telegram commands (the brain dump)

Default (no prefix): your message is classified (title / personal-work / priority) → task on the board + filed in the knowledge base + queued to Obsidian.

- `/chat` — talk, nothing saved · `/capture` (or `/stop`) — back to capture · `/clear` — wipe chat history
- `chat: <x>` — one-off chat · `ask: <x>` — answer from your knowledge base (in your voice, with citations)
- `task: <x>` — force-capture a task · `plan: <x>` — quick milestones+tasks
- `deepplan: <x>` — multi-agent deep planner: researches, **does the analysis itself**, texts progress, drops only the human to-dos on your board

## Under the hood

- Tasks: Redis (`/api/tasks`) · Knowledge base: Postgres full-text (`/api/knowledge/search`)
- Chat: `/api/chat` → Sonnet 5 over your KB with citations · Curate: `/api/command/curate`
- Profile: `/api/command/profile` (Redis `cc:profile`)
- Obsidian: notes queue in Redis and **auto-flush to your vault whenever the local app is open** (any page). Only works locally — the plugin listens on localhost.

---

## Known gaps (honest)

- **One Telegram message = one task.** A multi-thought dump doesn't split yet.
- **No push / reminders.** It won't text you first; you open the command page to see what's elevated.
- **No due-date parsing.** "by Friday" is captured as text, not a real deadline.
- **Telegram audio voice-notes** aren't transcribed (phone keyboard mic → text works fine).

## Next builds (ranked)

1. **Multi-task brain dump** — one message → split into every task/note inside it.
2. **Daily Telegram brief** — the morning push that elevates without you opening anything.
3. Real adapters — Pipedrive (token drop-in) or bank-CSV money.
