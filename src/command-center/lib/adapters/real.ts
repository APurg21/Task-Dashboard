// ============================================================
// Real adapter overrides wired to Task-Dashboard's own backend.
// Client-safe: these fetch our server routes (never vendor SDKs
// or secrets directly), so they run fine from client components
// and throw on failure — letting each component's try/catch fall
// back to its seeded mock/prop, per the build rule.
// ============================================================
import type { AIAdapter, ObsidianAdapter } from "./index";
import type { ChiefOfStaffAnswer, NoteHit } from "../types";

// ai.ask → our /api/chat (Sonnet 5 over the knowledge base, with citations).
// weeklyStory / draftInVoice stay on the mock until backed server-side.
export const realAiAsk: AIAdapter["ask"] = async (question): Promise<ChiefOfStaffAnswer> => {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}`);
  const data = (await res.json()) as { answer?: string };
  return { text: data.answer ?? "…" };
};

// obsidian.search → our /api/knowledge/search (Postgres full-text over notes).
export const realObsidianSearch: ObsidianAdapter["search"] = async (
  query: string
): Promise<NoteHit[]> => {
  const res = await fetch("/api/knowledge/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data = (await res.json()) as { hits?: NoteHit[] };
  return data.hits ?? [];
};
