# Session Handoff — pick up on another machine

> Reflects state as of the last push. Repo: GitHub `APurg21/Task-Dashboard`,
> auto-deploys to Vercel on push to `main`. For the full feature rundown see
> **COMMAND-CENTER.md**.

---

## 1. Get in sync first

**If already cloned:**
```powershell
cd $HOME\Task-Dashboard
git pull
npm install
```
**If not cloned:**
```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
# reopen PowerShell, then:
cd $HOME
git clone https://github.com/APurg21/Task-Dashboard.git
cd Task-Dashboard
npm install
git config --global user.name "Alex Purgason"
git config --global user.email "purgasonalexp@gmail.com"
```
Pull env vars (needed for local dev against real data):
```powershell
npx vercel link           # sign in, pick Task-Dashboard
npx vercel env pull .env.local
```
**Launch Claude Code from inside the `Task-Dashboard` folder** (not from home).

Note: `.claude/launch.json` is intentionally NOT committed — it hardcodes this
machine's Node path. The preview launcher will create/prompt for its own.

---

## 2. The product (short)

A personal Life OS. **Command Center at `/`** (blacklight cockpit) is home; the
**task board at `/tasks`** is the background engine. You brain-dump via Telegram
or the board, it organizes in Redis + a Postgres knowledge base, and the command
page elevates what matters. Full details: **COMMAND-CENTER.md**.

## 3. What's built & working

- Command Center: 5 views, 4 action modals, editable server-persisted profile.
- Today view reads/writes the live task board (Top-3 + checkoff write-back + ✦ curate).
- AI Chat over the knowledge base (Sonnet 5, citations) — command center, task
  board, and Telegram `ask:`.
- Editable Chief-of-Staff **voice** (Edit form) applied to every chat surface.
- Multi-agent **deep planner** (`deepplan:`) — researches, executes its own
  tasks, delivers results.
- Telegram capture + `chat`/`ask`/`task`/`plan`/`deepplan` commands.
- Obsidian **auto-sync**: notes flush to the vault automatically whenever the
  local app is open (any page). Local-only (plugin listens on localhost).
- Supabase Postgres + Drizzle schema exists; magic-link auth scaffolded (opt-in,
  currently open via blank `ALLOWED_EMAIL`).

## 4. Next builds (ranked — this is the resume point)

1. **Multi-task brain dump** — one Telegram message → split into every task/note
   inside it (today: one message = one task). *Start here.*
2. **Daily Telegram brief** — morning push of Top-3 + what's aging, so the system
   reaches out instead of waiting to be opened.
3. Real adapters — Pipedrive (`PIPEDRIVE_API_TOKEN` drop-in) or bank-CSV money.
4. Migrate tasks Redis → Postgres; finish/enable magic-link auth for deploy.

## 5. Notes / constraints

- Model is `claude-sonnet-5` throughout (user directive).
- Obsidian sync is local-only by design (Local REST API plugin on localhost:27123).
  The deployed site can't reach it; the local app auto-flushes the queue.
- Env vars in use: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `REDIS_URL`,
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`, `TELEGRAM_CHAT_ID`,
  `OBSIDIAN_API_KEY`, plus Supabase (`NEXT_PUBLIC_SUPABASE_URL`, keys).

## 6. First thing to tell Claude on the new machine

> "Read HANDOFF.md and COMMAND-CENTER.md. We're building the multi-task brain
>  dump: one Telegram message should split into every task/note inside it."
