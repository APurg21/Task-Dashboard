# Note capture → Obsidian

Drop a free-form thought into the **Capture a note** panel on the dashboard.
Claude classifies it as a current-project note, a new-project idea, a
brainstorm, or a task, and writes a markdown file into your Obsidian vault.

```
You type a note
  → POST /api/notes/classify   (Claude picks a folder + title + tags)
  → you review/edit, then Save
  → POST /api/notes/push       (writes the .md file into your vault)
  → Obsidian shows the new note instantly
```

## One-time setup

### 1. Anthropic API key (for classification)

Get a key at <https://console.anthropic.com>, then add it to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Classification and planning use `claude-sonnet-5`. To cut cost/latency you can
switch the model in `src/lib/classify.ts`, `src/lib/planner.ts`, and
`src/lib/deepPlanner.ts` to `claude-haiku-4-5`.

### 2. Obsidian Local REST API plugin (for writing notes)

1. In Obsidian: **Settings → Community plugins → Browse** → search
   **"Local REST API"** (by coddingtonbear) → Install → Enable.
2. Open the plugin's settings:
   - Turn on **"Enable Non-encrypted (HTTP) Server"** (listens on port 27123).
   - Copy the **API Key**.
3. Add the key to `.env.local`:

   ```
   OBSIDIAN_API_KEY=your-plugin-api-key
   ```

The app writes into these folders (created automatically on first write):

```
Dashboard/
  Projects/     ← current-project notes
  New Ideas/    ← new-project ideas
  Brainstorm/   ← brainstorming
  Tasks/        ← actionable to-dos
  Daily/        ← uncategorized captures
```

Every note gets YAML frontmatter (`type`, `created`, `project`, `tags`) so the
**Dataview** plugin can query them into live dashboards inside Obsidian.

## Important: local vs. deployed

The Local REST API plugin only listens on `localhost`. Note capture therefore
works when you run the app locally (`npm run dev`) on the same machine as
Obsidian. It will **not** work from the deployed Vercel site, which can't reach
your machine's `localhost`. The push route returns a clear error in that case;
classification still works anywhere the API key is set.

If you later want capture from the deployed site, switch to a sync method that
doesn't depend on localhost (e.g. the Obsidian Git plugin committing your vault
to a GitHub repo the app also writes to).
