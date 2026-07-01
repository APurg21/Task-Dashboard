# Session Handoff — pick up on the desktop

> Written from the laptop. Everything below reflects state as of the last push.
> The project lives on GitHub (APurg21/Task-Dashboard) and auto-deploys to Vercel
> (<https://task-dashboard-ap2tone.vercel.app>) on every push to `main`.

---

## 1. Get the desktop in sync (do this first)

Open PowerShell on the desktop.

**If the repo is already cloned there:**
```powershell
cd $HOME\Task-Dashboard
git pull          # commit or stash local changes first if git complains
npm install       # in case dependencies changed
```

**If it's NOT cloned yet** (see SETUP.md for the full version):
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

**Launch Claude Code from inside the `Task-Dashboard` folder**, not from the home
directory — launching from home makes file searches scan the whole drive (slow +
memory-heavy).

---

## 2. What was done this session

- ✅ **AI model switched Opus 4.8 → Sonnet 4.6** in `src/lib/classify.ts` and
  `src/lib/planner.ts` (cheaper/faster; live on the deployed site). Switch to
  `claude-haiku-4-5` for even cheaper, or back to `claude-opus-4-8` for max quality.
- ✅ **`/api/notify` endpoint** added (`src/app/api/notify/route.ts`) — a reusable
  "ping my iPhone via Telegram" channel. Gated on `TELEGRAM_SECRET_TOKEN`.
- ✅ **BUILD-PLAN.md** — full architecture + staged build plan (audit of the repo +
  2026 best-practice research). This is the roadmap.
- ✅ **AGENTS.md** — carries the Next.js rules block + the "Conductor" multi-agent
  workflow used when developing this project.
- ✅ Pulled in the desktop's earlier Life OS / Telegram / Obsidian / planner work.

## 3. What is NOT done yet (from BUILD-PLAN.md, in build order)

1. Neon Postgres + Drizzle + pgvector; migrate tasks off Redis; expand task schema.
2. Auth.js v5 (Google) — gates the dashboard AND grants Gmail/Drive/Calendar scopes.
3. Telegram → conversational Claude agent with memory (currently one-shot classify).
4. Gmail + Drive read/search tools → index into `sources`.
5. Obsidian read via a git-backed vault (Obsidian Sync is E2E-encrypted, not
   cloud-readable — the deployed app can't read it directly).
6. Daily-summary cron → `/api/notify`.
7. Approval gates (`pending_actions` + Telegram inline buttons).
8. Local-file agent → pgvector semantic search.

## 4. Open loops / unverified

- **`/api/notify` never fired end-to-end.** Verify by visiting once:
  `https://task-dashboard-ap2tone.vercel.app/api/notify?key=<TELEGRAM_SECRET_TOKEN>&text=test`
  → your phone should buzz.
- **`~/.claude` config sync is NOT finished.** The laptop has `~/.claude` as a local
  git repo (settings + memory committed) but no remote yet. To finish: create an empty
  private GitHub repo `claude-config`, then on the laptop
  `git remote add origin <url>; git push -u origin main`; on the desktop clone it into
  `~/.claude`. Until then, Claude Code settings/memory do NOT sync between machines.

## 5. Environment variables

The **deployed app already has all of these on Vercel** — you only need them locally if
you run `npm run dev` against real data. Pull them with:
```powershell
npx vercel link            # sign in, pick Task-Dashboard
npx vercel env pull .env.local
```

Currently used: `ANTHROPIC_API_KEY`, `REDIS_URL`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_SECRET_TOKEN`, `TELEGRAM_CHAT_ID`, `OBSIDIAN_API_KEY`, `OBSIDIAN_API_URL`,
`TWILIO_AUTH_TOKEN`, `TWILIO_MY_PHONE`.

## 6. Obsidian note

Note capture writes to the vault via the **Local REST API plugin** (localhost:27123) —
so it only works when running the app locally with Obsidian open on the same machine.
The deployed site can't reach localhost; texted notes queue until you hit "Sync to vault".

## 7. First thing to tell Claude on the desktop

> "Read HANDOFF.md and BUILD-PLAN.md. We're resuming the AI task-dashboard build.
>  Start Phase 1: Neon Postgres + Drizzle + pgvector and migrate tasks off Redis."

(Or pick any item from section 3.)
