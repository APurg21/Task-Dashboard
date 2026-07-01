# AI Work Operating System — Architecture & Build Plan

> Consolidates the detailed Work-OS vision with the existing repo and the earlier
> `BUILD-PLAN.md`. This is the authoritative plan going forward; `BUILD-PLAN.md`
> stays as background research. Nothing here is built beyond the "✅ Already built"
> section — this is the roadmap.

---

## 1. What's already built (the foundation exists)

You are not starting from zero. The current app already proves several core patterns:

| Capability | Status | Maps to Work-OS |
|---|---|---|
| Next.js 16 + TS + Tailwind on Vercel | ✅ | Frontend base |
| Task board (Kanban/List/Projects), metrics, sidebar | ✅ | Tasks + Command Center seed |
| Task model with context/priority/project/milestone/source | ✅ | Tasks table (partial) |
| AI classification (text → typed task) — Sonnet 5 | ✅ | Retrieval-free tool call |
| Quick planner (`plan:`) — idea → milestones+tasks | ✅ | Task Planner seed |
| **Deep planner** (`deepplan:`) — scope→research→3 drafts→critique→synthesize | ✅ | **Multi-agent seed (Phase 6)** |
| Telegram bot (capture, plan, deep plan, background `after()`) | ✅ | Phase 7 partial |
| Obsidian write (local REST API) + cloud pending queue | ✅ | Knowledge write path (local) |
| Redis (Upstash) for state | ✅ | Move tasks → Postgres; keep for cache/queue |

**Key insight:** the deep planner already implements the orchestrator → research →
draft → critique → synthesize pattern. Phase 6 is a generalization of it, not a
green-field build.

**The gaps** (what this plan builds): a real database + retrieval (RAG), auth,
AI chat with tools + citations, knowledge ingestion, Google integrations,
reports, voice profile, an approval queue, and the generalized agent layer.

---

## 2. Recommended stack (decisions, not a menu)

You listed options; here are opinionated picks with rationale. The three marked
**[CONFIRM]** are foundational — worth a deliberate yes before we start.

| Layer | Pick | Why |
|---|---|---|
| DB **[CONFIRM]** | **Supabase Postgres + Drizzle ORM + pgvector** | One service gives Postgres, pgvector, Auth, file Storage, and Row-Level Security. Drizzle gives typed queries. Fewer moving parts than Neon+separate-auth+separate-storage. |
| Auth **[CONFIRM]** | **Supabase Auth, Google provider, single-email gate** | One Google login = app auth **and** Gmail/Drive/Calendar API tokens. Consolidated with the DB. (Fallback: Auth.js — the `BUILD-PLAN` choice — if Supabase's Google-token handling chafes.) |
| AI chat/tools | **Vercel AI SDK v5 + `@ai-sdk/anthropic`** | Best streaming-chat + tool-calling ergonomics on Vercel. Keep `@anthropic-ai/sdk` for the structured pipelines already built (deep planner). |
| Model | **Claude Sonnet 5** | Your standing choice. Opus for the hardest agent steps only if needed. |
| Embeddings **[CONFIRM]** | **OpenAI `text-embedding-3-small`** (needs an OpenAI key) | Cheapest ($0.02/1M), ubiquitous, 1536-dim. Alt: Voyage AI (Anthropic-aligned) or local `nomic-embed-text` for zero external calls. |
| UI kit | **shadcn/ui**, added incrementally | Use for new surfaces (chat, command center); keep existing working components. |
| Background jobs | **Vercel `after()` + QStash** | `after()` for ≤300s (Fluid Compute); QStash for longer agent runs. |
| Hosting / cache / queue | **Vercel + Upstash Redis** | Already in place. Redis = chat session buffer, rate-limit, QStash queue. |

**Migration note:** the current tasks live in a Redis blob. Phase 1 reads that
blob once and inserts rows into Postgres, then the app reads/writes Postgres.

---

## 3. Architecture

```
        iPhone (Telegram)          Browser (Dashboard: Command Center · Chat ·
         capture · ask · approve     Tasks · Projects · Knowledge · Reports · Agents)
                  │                                   │
                  ▼                                   ▼
   ┌───────────────────────── Vercel (Next.js, Node runtime, Fluid Compute) ──────────────────┐
   │  Auth (Supabase, Google, 1 email)                                                          │
   │  /api/chat        → Agent loop (Vercel AI SDK + Claude Sonnet 5)                            │
   │  /api/telegram ✅  → same tools, fast 200 + after()/QStash                                  │
   │  /api/ingest/*    → Obsidian / Drive / upload → chunk → embed → store                       │
   │  /api/agents/run  → orchestrator → sub-agents (Phase 6)                                     │
   │  /api/approvals   → approve/reject queued external actions                                  │
   │                                                                                            │
   │  TOOLS (the agent's hands):                                                                 │
   │   read/auto:  search_knowledge · search_tasks · search_projects · get_calendar ·           │
   │               search_gmail · search_drive · summarize_source · get_voice_profile           │
   │   write/gated: create_task · update_task · draft_email · create_report · write_obsidian    │
   └───────────┬───────────────────────────┬──────────────────────────────┬─────────────────────┘
               ▼                           ▼                              ▼
   Supabase Postgres + pgvector    Upstash Redis + QStash        Google APIs (OAuth, read-only)
   structured + knowledge chunks   chat buffer · queue · cache   Gmail · Drive · Calendar
               ▲
               │ ingestion (chunk → embed → upsert)
     Obsidian (git-backed vault for cloud read/write) · Drive files · uploads
```

**The core loop (RAG + tools + approval):**
1. Request comes in (chat or Telegram).
2. Agent decides which tools/sources it needs.
3. It **retrieves** (pgvector semantic search + structured queries) *before* answering.
4. It answers with **source citations**, separating facts / assumptions / risks / next actions.
5. Any external write (email, file, calendar, CRM) → **approval_queue** row → you tap approve → executes.
6. Every step logged to `agent_runs` / `audit_logs`.

---

## 4. Data model (Postgres + pgvector)

Grouped for clarity; fields per your spec. Drizzle schema in `src/lib/db/schema.ts`.

**Identity & connections**
- `users`, `connected_accounts` (Google/CRM tokens, encrypted at rest)

**Knowledge / RAG**
- `sources` (email, drive file, note, upload — one row per external object)
- `documents` (a source's parsed content) → `document_chunks` (chunked text)
- `document_chunks` fields: `source_type · source_name · source_id · title · text ·
  created_at · updated_at · url · tags · project_id · contact_id · permission_level ·
  embedding vector(1536) · summary · confidence` (HNSW index on `embedding`)
- (`embeddings` folded into `document_chunks.embedding` — one table, one query does filter + semantic search)

**Structured work**
- `tasks` (title · description · status · priority · due_date · source_type · source_id ·
  project_id · contact_id · company_id · ai_reason · created_by · approved_by_user)
- `projects` (name · status · goal · risks · open_questions · latest_summary · next_actions)
- `contacts`, `companies`, `emails`, `calendar_events`

**AI outputs & governance**
- `reports` (title · report_type · user_prompt · sources_used · findings · recommendations · risks · next_actions · status)
- `report_runs`, `agent_runs` (user_request · agent_name · steps_taken · tools_used · sources_used · output · confidence · errors), `agent_steps`
- `conversation_logs`
- `voice_profile` + `style_examples` (your writing samples for the Voice system)
- `approval_queue` (tool_name · tool_args · risk_tier · reason · status · expires_at)
- `audit_logs` (append-only)

---

## 5. Agent design (built for multi-agent, simulated first)

**Phase 1–5:** a *single* Claude call with the full tool set does the work
(retrieve → reason → act). This already gives 80% of the value.

**Phase 6:** generalize the deep planner into a reusable orchestration layer:

| Agent | Role | Reuses |
|---|---|---|
| Orchestrator | Break request into steps, pick tools, delegate | deep planner's stage runner |
| Research | Search knowledge/Drive/Gmail/notes/web | `search_*` tools + web_search |
| Data Analyst | Spreadsheets, CRM, revenue, metrics | new; code-exec or SQL |
| Report Writer | Findings → polished report | deep planner's synthesize stage |
| Task Planner | Findings → tasks/priorities/deadlines | existing `planToTasks` |
| Communication | Draft emails/posts in your voice | `get_voice_profile` + draft tools |
| QA / Source Check | Accuracy, missing context, weak claims, source quality | deep planner's critique stage |

Each agent = a system prompt + a tool subset + a schema. `agent_runs`/`agent_steps`
log every hop. Start with orchestrator + 2 agents; add the rest incrementally.

---

## 6. Security & governance (non-negotiable, built in from Phase 1)

- **Approval queue** for every outside-world action (send email, edit/delete file,
  create calendar event, update CRM, message others, modify source notes, bulk task
  changes). AI *prepares*; you *approve*.
- **Read-only by default** on all Google scopes; writes are drafts + approval.
- OAuth tokens **encrypted at rest** (AES-256-GCM, key in Vercel env); minimal scopes.
- Single-email auth gate. `audit_logs` append-only for every AI action.
- Rate-limit via `@upstash/ratelimit`. Graceful fallback on any 3rd-party failure.
- **Freshness checks:** retrieval notes each chunk's age; the AI flags stale sources
  and never treats an old note as current truth.

---

## 7. Build plan (phased, with the smartest first slice)

Refined from your 7 phases. The principle: **Phase 1 ships a thin vertical slice
that proves the whole spine** (auth + DB + RAG + tools + citations + approval),
then each phase widens it.

### Phase 1 — Spine (prove the architecture end-to-end)
1. Stand up **Supabase** (Postgres + pgvector + Auth). Drizzle schema for the core
   tables (users, tasks, projects, sources, documents, document_chunks,
   conversation_logs, approval_queue, audit_logs).
2. **Migrate** tasks Redis → Postgres; point the app at Postgres.
3. **Auth**: Supabase Google login, single-email gate on the dashboard.
4. **AI Chat** (`/api/chat`, Vercel AI SDK, streaming) with 3 tools:
   `search_knowledge` (pgvector), `create_task`, `search_tasks` — retrieve-before-answer + citations.
5. **One ingestion path**: document/markdown upload → chunk → embed → store, so the
   knowledge base isn't empty.
6. **Approval queue** table + a minimal "pending actions" UI (proves the gate).

*Outcome:* "Ask a question → it searches my notes → answers with citations → creates
a task, pending my ok." The heart of the system, working.

### Phase 2 — Knowledge base (fill it)
Obsidian markdown ingestion (git-backed vault for cloud read), Drive-less uploads,
richer chunking, semantic search UI, source-citation rendering, freshness flags.

### Phase 3 — Work integrations
Gmail read/search → tasks + waiting-on detection · Drive read/search → ingest as
sources · Calendar → meetings + briefs. All read-only; drafts/writes via approval.

### Phase 4 — Reports
Report builder: goal → research questions → multi-source gather → analyze → write
(facts/findings/risks/recs/next-actions) → save + export. Reuses the agent loop.

### Phase 5 — Personal voice
`voice_profile` + `style_examples`; capture your best writing; feedback buttons;
`get_voice_profile` tool so drafts match your voice; improve from approved examples.

### Phase 6 — Multi-agent layer
Generalize the deep planner: orchestrator + specialized agents + `agent_runs`
logging + QA agent + report pipeline. Add agents one at a time.

### Phase 7 — Telegram (extend what exists)
From one-shot capture → conversational agent, daily summaries, voice-note
transcription. Much of the plumbing (webhook, `after()`, tools) is already there.

---

## 8. Command Center (the daily landing page)
Today's priorities · important tasks · waiting-on · follow-ups · meetings today ·
recent changes (since yesterday) · suggested actions. Built on the same tools —
it's a saved set of queries the agent runs on load.

---

## 9. Decisions needed before Phase 1
1. **Database:** Supabase (recommended) vs Neon + separate auth?
2. **Auth:** Supabase Auth (recommended) vs Clerk vs Auth.js?
3. **Embeddings:** OpenAI 3-small (recommended, needs OpenAI key) vs Voyage vs local?
4. **Obsidian cloud path:** git-backed vault now, or keep local-only for Phase 1?
5. **Cost tolerance:** all free tiers are sufficient for Phase 1 (Supabase free,
   Vercel Hobby+Fluid, Upstash free); embeddings + Claude are pay-per-use pennies.

## 10. Initial system prompt (locked)
Stored in `src/lib/agent/prompts.ts` — the Work-OS operating rules (retrieve before
answering, don't guess private facts, cite sources, match voice, structure outputs,
approval before external actions, prefer next actions over explanation).
