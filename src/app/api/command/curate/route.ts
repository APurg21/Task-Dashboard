import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";

// "Curate my Top 3" — the Chief of Staff re-ranks your OPEN tasks and picks the
// few that actually move the needle today, split work vs personal, with a one
// line rationale. On-demand only (a button), never on the render path, so there
// is no always-on cost.

export const maxDuration = 30;

interface InTask {
  id: string;
  title: string;
  priority: string;
  context?: string;
  ageDays?: number;
}

const SCHEMA = {
  type: "object",
  properties: {
    work: {
      type: "array",
      items: { type: "string" },
      description: "Up to 3 WORK task ids, most important first.",
    },
    life: {
      type: "array",
      items: { type: "string" },
      description: "Up to 3 PERSONAL task ids, most important first.",
    },
    why: {
      type: "string",
      description: "One short sentence on the logic behind today's picks.",
    },
  },
  required: ["work", "life", "why"],
  additionalProperties: false,
} as const;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "no ANTHROPIC_API_KEY" }, { status: 503 });

  let body: { tasks?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const tasks: InTask[] = Array.isArray(body.tasks) ? (body.tasks as InTask[]) : [];
  if (!tasks.length) return Response.json({ work: [], life: [], why: "No open tasks." });

  const list = tasks
    .map(
      (t) =>
        `- id=${t.id} | ${t.context === "work" ? "WORK" : "PERSONAL"} | ${t.priority} | ${
          t.ageDays ?? 0
        }d old | ${t.title}`
    )
    .join("\n");

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system:
        "You are the user's chief of staff. From their open tasks, pick the few that most move the needle TODAY — weigh urgency, deadlines/age, priority, and leverage (unblocks other work, time-sensitive, high stakes). Return up to 3 WORK task ids and up to 3 PERSONAL task ids, most important first, using only ids from the list. Give one short sentence on your logic.",
      messages: [{ role: "user", content: `Open tasks:\n${list}` }],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    const parsed = JSON.parse(text) as { work: string[]; life: string[]; why: string };
    const ids = new Set(tasks.map((t) => t.id));
    return Response.json({
      work: (parsed.work ?? []).filter((id) => ids.has(id)).slice(0, 3),
      life: (parsed.life ?? []).filter((id) => ids.has(id)).slice(0, 3),
      why: parsed.why ?? "",
    });
  } catch (err) {
    console.error("[curate] failed:", err);
    return Response.json({ error: "curate failed" }, { status: 500 });
  }
}
