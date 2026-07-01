# Text your phone → dashboard (Telegram)

Message your Telegram bot and the text is classified by Claude, dropped onto
your dashboard as a prioritized task, and queued for Obsidian.

```
You text the bot  →  /api/telegram (on Vercel)
   → Claude classifies (type · personal/work · priority · title)
   → creates a task in Redis  →  shows on your dashboard
   → queues the note  →  local app's "Sync to vault" writes it to Obsidian
   → bot replies to confirm
```

## Why it works this way

Telegram delivers messages to a public HTTPS URL, so the webhook lives on your
**deployed Vercel app** — that's what creates the task (the deployed app and your
local app share the same Redis, so it appears on your dashboard either way).

The deployed app can't reach your local Obsidian, so texted notes are queued.
Your **local** dashboard flushes them to the vault via the "Sync to vault" button
in the sidebar (or it auto-checks every 30s). Keep Obsidian open and click sync.

## Setup

### 1. Create the bot

1. In Telegram, message **@BotFather**.
2. Send `/newbot`, pick a name and username. BotFather replies with a **token**
   like `8123456789:AAH...`. Copy it.

### 2. Add the env vars (in **Vercel**, and locally)

The webhook runs on Vercel, so set these in your Vercel project:
`Settings → Environment Variables`.

```
TELEGRAM_BOT_TOKEN     = the token from BotFather
TELEGRAM_SECRET_TOKEN  = any random string you invent (e.g. a long password)
ANTHROPIC_API_KEY      = your Anthropic key   (needed for classification)
```

Leave `TELEGRAM_CHAT_ID` unset for now — you'll fill it in step 4. Add the same
values to your local `.env.local` too (so the local app matches).

Redeploy (or `git push`) so Vercel picks up the new vars.

### 3. Register the webhook (one click)

Visit this once in your browser:

```
https://<your-vercel-app>.vercel.app/api/telegram/setup
```

It points Telegram at your webhook and returns `{"ok":true}`. Done.

### 4. Lock the bot to you

1. Message your bot `/id`. It replies with **your chat ID** (a number).
2. Set `TELEGRAM_CHAT_ID` to that number in Vercel (and `.env.local`), redeploy.

Now only your messages are accepted.

### 5. Use it

Text the bot anything:

- *"URGENT: call the plumber about the kitchen leak today"* → task · personal · **high**
- *"idea: a weekend project to build a birdhouse"* → new-project · personal · low
- *"finish the Q3 report draft before Friday"* → task · work · high

Each one appears on your dashboard instantly and the bot confirms. When you're
at your computer with Obsidian open, hit **Sync to vault** to file the notes.

### Planning commands

- **`plan: <idea>`** — quick plan. One AI pass → milestones + tasks on the board.
- **`deepplan: <idea>`** — deep, multi-agent plan. Scopes the idea, researches
  it on the web, drafts 3 approaches in parallel, red-teams them, and synthesizes
  one rigorous plan. Runs in the background and texts you progress, then the final
  outline. Lands in the **Projects** view + a full Obsidian project page.

Both also work from the dashboard's capture box (Plan as project / Deep plan).

> ⚠️ **Enable Fluid Compute (free).** A deep plan makes several AI calls and runs
> ~2–4 minutes. Enable **Fluid Compute** in Vercel (Settings → Functions) — this
> raises the **free Hobby** tier to a **300s** max duration, which the pipeline
> fits inside. No Pro plan needed. The `deepplan` route already sets
> `maxDuration = 300`. Without Fluid Compute, Hobby caps at ~60s and a deployed
> deep plan would be cut off. (It always completes when run locally.)

## Local testing (optional)

To test the webhook on your own machine, expose `localhost:3000` with a tunnel
(e.g. `npx localtunnel --port 3000` or ngrok) and run the `/api/telegram/setup`
on the tunnel URL. Otherwise just test on the deployed app.
