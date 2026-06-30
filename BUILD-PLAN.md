# AI Personal Operating System — Architecture & Build Plan

> Status of this doc: produced 2026-06-30 from (a) a full audit of this repo and
> (b) parallel current-best-practice research (Vercel, Telegram, Google APIs,
> data/vector, local-file agents, security — all verified against 2026 docs).
> Items already built in this repo are marked ✅ and crossed off the build lists.

---

# Executive Summary

You already have a deployed, Claude-powered task dashboard with a working Telegram
intake, note classification, project planning, and Obsidian write-out. The goal is to
evolve it into an **AI chief of staff**: a conversational Telegram assistant backed by a
real database, semantic search over your knowledge (Gmail/Drive/Calendar/Obsidian/local
files), and a human-approved action layer — **AI-first but human-approved**.

The build is staged: **MVP** (durable DB + conversational Telegram agent + Gmail/Drive
read + Obsidian read) then **Full** (local-file agent, vector search, calendar, voice,
proactive reviews, approval gates everywhere).

**Headline decisions (changes from the original spec):**
1. **Stay on Claude** (`@anthropic-ai/sdk`) — already in use. Add **Vercel AI SDK v7**
   for the tool-calling agent loop + streaming. **Do NOT use OpenAI Assistants API** —
   deprecated, hard shutdown **Aug 26, 2026**.
2. **Postgres = Neon + Drizzle + pgvector.** Keep **Upstash Redis** for conversation
   state, cache, rate-limiting, and **QStash** queues.
3. **Obsidian: switch to a git-backed vault.** Obsidian Sync is end-to-end encrypted, so
   the deployed app cannot read it. A GitHub-backed vault (Obsidian Git plugin) is the
   cloud-readable bridge. The current Local REST API path stays as the localhost fast path.
4. **Local files = a small local agent** that indexes allowlisted folders and pushes
   extracted text + embeddings **outbound** to Neon. The cloud never reaches into your PC.
5. **Auth = Auth.js v5 with Google**, single-email gate — and the same Google OAuth grants
   Gmail/Drive/Calendar scopes. One login solves two problems.

---

# Recommended Architecture

```
                 ┌──────────────── iPhone (Telegram) ────────────────┐
                 │  natural-language chat · voice · photos · approvals │
                 └───────────────────────┬────────────────────────────┘
                                         │ webhook (secret_token verified)
                                         ▼
   ┌─────────────────────────── Vercel (Next.js 16, Node runtime) ───────────────────────────┐
   │  /api/telegram  ── fast 200, then after()/QStash ──► Agent loop (Vercel AI SDK + Claude)  │
   │  /api/chat (dashboard)        Agent tools:  create/update/search task · search Gmail ·    │
   │  /api/notify  (✅ built)        read email · search Drive · read file · search vault ·     │
   │  /api/cron/* (daily summary)    search local index · summarize · propose action(approval) │
   │  Auth.js v5 (Google, 1 email)                                                              │
   └───────┬───────────────────────┬───────────────────────────┬──────────────────────────────┘
           │                       │                           │
           ▼                       ▼                           ▼
   Neon Postgres            Upstash Redis              Google APIs (OAuth, offline)
   + Drizzle + pgvector     · convo state (TTL)        Gmail / Drive / Calendar (read; write=approved)
   tasks·projects·sources   · cache · rate-limit       GitHub API → git-backed Obsidian vault
   ·conversations·actions   · QStash job queue
           ▲
           │ outbound push (HTTPS + bearer token); cloud never connects inbound
   ┌───────┴──────────── Local Agent (your PC, Node) ────────────┐
   │ chokidar watcher → allowlisted folders only → parse (pdf/docx/xlsx/csv/md/OCR)
   │ → embed → upsert text+vectors into Neon. Read-only. Secret-scan before upload.
   └─────────────────────────────────────────────────────────────┘
```

# Why This Architecture

- **Serverless reality:** Vercel Node functions (Fluid Compute) allow 300s (Hobby) /
  800s (Pro) and bill only active CPU — I/O waits on Claude are free. Edge runtime is
  deprecated for new code. So: Node runtime, return Telegram's 200 fast, do AI work in
  `after()` or a QStash worker.
- **One database, not five:** A single-user knowledge base stays well under 1M vectors,
  where pgvector in Neon beats a separate vector DB (one SQL query does filter + semantic
  search; no cross-service sync; ~$0 at this scale).
- **Outbound-only local agent:** never expose your PC to the internet — the agent makes
  authenticated outbound calls, so there is no inbound attack surface.
- **Human-approved by construction:** risky tools write a `pending_actions` row and ask
  via a Telegram inline button; nothing irreversible happens without your tap.

# System Diagram in Text
(See the Recommended Architecture block above.)

# Tech Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19 | ✅ already here |
| Hosting | Vercel, Node runtime + Fluid Compute | ✅ deployed |
| AI model | Claude `claude-opus-4-8` (reasoning), `claude-haiku-4-5` (classify/cheap) | ✅ SDK present |
| Agent loop | **Vercel AI SDK v7** + `@ai-sdk/anthropic` (`ToolLoopAgent`, `stopWhen`) | add |
| DB | **Neon Postgres** + **Drizzle ORM** + **pgvector** | add (migrate off Redis-only) |
| Cache / queue / convo | **Upstash Redis** + **QStash** | Redis ✅ present; add QStash |
| Embeddings | OpenAI `text-embedding-3-small` ($0.02/1M) — or local `nomic-embed-text` | add |
| Auth | **Auth.js v5** + Google provider, single-email gate | add |
| Google | googleapis SDK, OAuth offline, minimal scopes | add |
| Telegram | Bot API webhook + secret_token | ✅ present (extend) |
| Voice STT | `gpt-4o-mini-transcribe` ($0.003/min) | add (Full) |
| File parsing | pdf-parse, mammoth (docx), xlsx, csv-parse, marked, Tesseract/Claude-vision OCR | local agent |
| Local watcher | chokidar (Node) | local agent |

# Integrations

- **Telegram** ✅ webhook/secret/classify/reply/chat-lock → extend to conversational agent + voice + approvals.
- **Gmail / Drive / Calendar** — Google OAuth (Testing mode, self as test user). See strategy sections.
- **Obsidian** — switch deployed path to git-backed vault; keep Local REST API for localhost.
- **Local files** — local agent, outbound push to Neon.

# Database Schema (Drizzle / Postgres)

Replaces the current Redis `"tasks"` blob. Migration = read Redis blob once, insert rows.

```sql
-- tasks
id uuid pk · title text · description text · status text · priority text
· due_at timestamptz · context text(personal|work) · project_id uuid
· source_type text · source_id text · source_summary text · related_people text[]
· tags text[] · ai_confidence real · ai_next_action text · waiting_on text
· recurrence text · conversation_id uuid · completed_at timestamptz
· created_at timestamptz · updated_at timestamptz

-- projects
id uuid pk · name · description · status · priority · goals text[]
· next_actions text[] · decisions jsonb · created_at · updated_at

-- conversations  (Telegram/dashboard threads)
id uuid pk · source text · summary text · related_task_ids uuid[]
· related_project_ids uuid[] · created_at · updated_at
-- (live message buffer lives in Redis with TTL; durable summary lands here)

-- sources  (emails, drive files, notes, local files)  + vector column
id uuid pk · type text · title · url_or_path text · provider text
· metadata jsonb · extracted_text text · summary text
· embedding vector(1536)  -- pgvector; HNSW index
· created_at · updated_at

-- pending_actions  (human-approval gate)
id uuid pk · tool_name text · tool_args jsonb · risk_tier text · reason text
· status text(pending|approved|rejected|expired) · expires_at timestamptz
· decided_at · decided_by · created_at

-- audit_log  (append-only)
id bigserial pk · request_id uuid · event_type text · actor_id text
· channel text · payload jsonb · recorded_at timestamptz
```

# AI Tool Definitions (agent tools)

Read-only (auto): `create_task`, `update_task`, `search_tasks`, `search_projects`,
`create_project`, `attach_source_to_task`, `suggest_priority`, `ask_clarification`,
`search_gmail`, `read_email_thread`, `search_drive`, `read_drive_file`,
`search_vault`, `read_note`, `search_local`, `read_local_file`, `summarize_source`,
`extract_action_items`, `generate_daily_plan`, `generate_weekly_review`,
`detect_stale_tasks`, `detect_waiting_on`, `detect_conflicting_deadlines`.

Approval-gated (writes `pending_actions`, then Telegram ✅/❌): `send_email`,
`delete_or_archive_task`, `modify_drive_file`, `write_to_obsidian`, `create_calendar_event`,
`access_new_local_folder`.

# Telegram Bot Workflow

1. Webhook verifies `x-telegram-bot-api-secret-token` (✅) and chat-ID lock (✅).
2. Return 200 immediately; process in `after()` (≤~60s) or enqueue to QStash (longer).
3. `sendChatAction "typing"`; load convo history from Redis (`chat:<id>:history`, 24h TTL).
4. If voice → getFile → transcribe; if photo/doc → getFile → Claude vision / parse.
5. Run the Claude tool-loop with the tools above; clarifying questions come back as messages.
6. Risky tool → `pending_actions` row + inline-keyboard approval message.
7. Persist reply to history; durable summary to `conversations`.

# Dashboard Views

Today · Inbox (AI-suggested / needs-clarification / unprocessed) · Projects · Tasks
(filterable) · Waiting On · Sources · Review (daily/weekly) · Settings (integrations,
OAuth status, bot status, local-agent status, folder allowlist).
✅ Existing: Kanban, List, Projects, Metric cards, Quick add, Capture, Import, Sidebar.

# Local Computer File Strategy

Small Node service on your PC: **chokidar** watches an **allowlist** of folders →
parse (pdf-parse, mammoth, xlsx, csv-parse, marked, OCR via Tesseract or Claude vision) →
chunk → embed → **upsert into Neon `sources`** over HTTPS with a bearer token.
Read-only. `.gitignore`-style ignore rules + secret scan before any upload. Incremental
via mtime comparison. **No inbound port; the cloud never connects to your PC.**

# Google Drive Strategy

OAuth `drive.readonly`. List/search via Drive API; export Google Docs to `text/markdown`;
Sheets via Values API; PDFs → download `alt=media` then pdf-parse. Link files to tasks as
`sources`. Writes (`drive.file`) are approval-gated only.

# Gmail Strategy

OAuth `gmail.readonly` (+ `gmail.compose` for drafts, approval-gated). Search via `q=`
(`is:important is:unread`, `in:sent` for waiting-on). Summarize threads with Claude; create
follow-up tasks; **never send without explicit approval** (drafts only).

# Obsidian Strategy

- **Deployed (new):** git-backed vault. Obsidian **Git plugin** commits your vault to a
  private GitHub repo; the app reads/writes notes via the GitHub API. Works from Vercel,
  survives the localhost limitation, and is conflict-safe. Writes are approval-gated.
- **Local (keep):** ✅ Local REST API plugin for instant localhost writes.
- Read path (new): index vault markdown into `sources` for `search_vault`.
- Obsidian **Sync** stays as your device-to-device sync; it is **not** the app's data path
  (E2E encrypted, not server-readable).

# Security and Privacy Plan

- OAuth tokens encrypted at rest (AES-256-GCM; key in Vercel env). Minimal scopes.
- Telegram webhook secret_token with constant-time compare (✅, harden).
- Dashboard auth: Auth.js v5, single allowed email.
- `audit_log` for every AI action; `pending_actions` gate for all writes/sends/deletes.
- Rate-limit via `@upstash/ratelimit`. Graceful fallback on any third-party failure.
- `/api/notify` ✅ gated on `TELEGRAM_SECRET_TOKEN`.

# MVP Build Plan

1. ✅ Telegram intake, task CRUD, classify, plan, Obsidian write, dashboard, Redis.
2. Stand up Neon + Drizzle + pgvector; migrate tasks Redis→Postgres; expand task schema.
3. Add Auth.js v5 (Google) → gate dashboard + obtain Google tokens.
4. Convert Telegram from one-shot classify → **conversational agent** (Vercel AI SDK +
   Claude tool loop), history in Redis.
5. Gmail + Drive **read/search** tools; index results into `sources`.
6. Obsidian **read** via git-backed vault; `search_vault` tool.
7. Daily summary via Vercel Cron → `/api/notify` to your phone.
8. `pending_actions` + Telegram inline-button approvals (manual approval queue).

# Full Build Plan

Local-file agent · full source indexing + pgvector semantic search · Calendar · voice
messages · AI weekly reviews · waiting-on detection · email follow-up tracking · Obsidian
write-back (approved) · dashboard analytics · multi-source reasoning · proactive
suggestions · QStash background jobs.

# Deployment Plan

Already auto-deploys on push to `main` (Vercel). New env vars set in Vercel dashboard;
local agent runs via `npm run agent` on your PC (PM2 for autostart). Neon + Upstash +
Google credentials added as env. `vercel env pull .env.local` to mirror locally.

# Environment Variables

Existing ✅: `ANTHROPIC_API_KEY`, `REDIS_URL`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_SECRET_TOKEN`, `TELEGRAM_CHAT_ID`, `OBSIDIAN_API_KEY`, `OBSIDIAN_API_URL`,
`TWILIO_AUTH_TOKEN`, `TWILIO_MY_PHONE`.

Add: `DATABASE_URL` (Neon), `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`ALLOWED_EMAIL`, `GOOGLE_OAUTH_REFRESH_TOKEN` (encrypted), `TOKEN_ENC_KEY`,
`OPENAI_API_KEY` (embeddings only) or local embed, `QSTASH_TOKEN`,
`OBSIDIAN_GIT_REPO` + `GITHUB_TOKEN`, `LOCAL_AGENT_TOKEN`.

# File Structure (additions)

```
src/
  app/api/
    telegram/route.ts        ✅  (extend → agent)
    notify/route.ts          ✅  (this commit — iPhone status channel)
    chat/route.ts            +   dashboard agent (streaming)
    auth/[...nextauth]/route.ts +
    cron/daily/route.ts      +   daily summary → notify
    google/callback/route.ts +
  lib/
    db/ (schema.ts, client.ts via Drizzle)   +
    agent/ (tools.ts, loop.ts, prompts.ts)   +
    google/ (gmail.ts, drive.ts, calendar.ts, oauth.ts) +
    vault/ (git.ts) · embed.ts · approvals.ts +
local-agent/                 +   standalone Node watcher (chokidar + parsers)
```

# Example Code Where Useful

`/api/notify` is implemented in this commit. Telegram secret verify, Vercel AI SDK
`ToolLoopAgent`, Auth.js Google single-email gate, pgvector upsert, and Telegram
inline-approval patterns are all captured with working snippets in the research appendix
(available on request) and will be added file-by-file in the build phases above.

# Risks and Tradeoffs

- **Google Testing-mode tokens expire every 7 days.** Mitigate with a Google Workspace
  Internal app (no expiry) or accept weekly re-auth. (Restricted Gmail/Drive scopes
  otherwise require costly CASA verification.)
- **Vercel timeouts.** Long agent runs need QStash/Workflows, not a single function.
- **Embeddings provider.** Anthropic has no embeddings API; use OpenAI
  `text-embedding-3-small` (cheap) or local `nomic-embed-text` to stay fully local.
- **Local agent is the biggest new surface.** Keep it outbound-only, read-only, allowlisted.

# Final Recommended Build Order

1. Neon + Drizzle + pgvector; migrate tasks; expand schema.
2. Auth.js v5 Google (gate + tokens).
3. Telegram → conversational Claude agent (Vercel AI SDK), Redis history.
4. Gmail + Drive read tools → index into `sources`.
5. Obsidian git-backed read; `search_vault`.
6. Daily summary cron → `/api/notify` (✅ channel ready).
7. `pending_actions` + Telegram approvals.
8. Local-file agent → pgvector semantic search.
9. Calendar · voice · weekly reviews · proactive suggestions.
```
