import { after } from "next/server";
import type { NextRequest } from "next/server";
import { answerQuestion, type ChatTurn } from "@/lib/chat";
import { chunkCount } from "@/lib/knowledge";
import { MissingApiKeyError } from "@/lib/classify";
import { parseVerb, captureToBoard, quickPlanToBoard, queueDeepPlan } from "@/lib/commandRouter";
import { runDeepPlan } from "@/lib/deepPlanner";

// AI Chat over the knowledge base — now with Telegram verb parity. POST a
// question (+ optional recent history): plain text and `ask:` get a grounded
// answer with numbered sources; `task:` / `plan:` / `deepplan:` run the same
// capture pipelines as the Telegram bot (via commandRouter) and return a
// confirmation the CoS box can render. GET returns stored chunk count.

// Deep plans run in the background via after(); match the webhook's ceiling.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { question?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  let question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return new Response("question required", { status: 400 });

  // Verb commands — identical semantics to the Telegram bot.
  const cmd = parseVerb(question);
  if (cmd && cmd.verb !== "ask") {
    try {
      if (cmd.verb === "task") {
        const outcome = await captureToBoard(cmd.arg, "ui");
        if (outcome.fallbackTask) {
          return Response.json({
            answer: `Added to your board: ${cmd.arg}`,
            sources: [], usedKnowledge: false,
            command: { kind: "task", items: [{ title: cmd.arg }] },
          });
        }
        const items = outcome.items!;
        const tag = (c: (typeof items)[number]) =>
          `${c.entityType !== "task" ? c.entityType + " · " : ""}${c.context}/${c.priority}${c.dueAt ? " · due " + new Date(c.dueAt).toISOString().slice(0, 10) : ""}`;
        const answer = items.length === 1
          ? `✅ ${items[0].title} — ${tag(items[0])}${items[0].matchedProject ? ` → ${items[0].matchedProject}` : ""}. On your board and queued for Obsidian.`
          : `🧠 Captured ${items.length} from that:\n${items.map((c) => `• ${c.title} — ${tag(c)}`).join("\n")}\nAll on your board and queued for Obsidian.`;
        return Response.json({
          answer, sources: [], usedKnowledge: false,
          command: { kind: "task", items: items.map((c) => ({ title: c.title, tag: tag(c) })) },
        });
      }

      if (cmd.verb === "plan") {
        const { plan, taskCount } = await quickPlanToBoard(cmd.arg, "ui");
        const outline = plan.milestones.map((m, i) => `${i + 1}. ${m.name} (${m.tasks.length})`).join("\n");
        return Response.json({
          answer: `📋 ${plan.projectTitle} — ${plan.milestones.length} milestones, ${taskCount} tasks\n${outline}\nOn your board and queued for Obsidian.`,
          sources: [], usedKnowledge: false,
          command: { kind: "plan", title: plan.projectTitle, milestones: plan.milestones.length, tasks: taskCount },
        });
      }

      // deepplan — long-running: queue the job, run it after the response so
      // the box isn't blocked. Progress pings go to Telegram (env fallback).
      const id = await queueDeepPlan(cmd.arg);
      after(async () => {
        await runDeepPlan(id, cmd.arg);
      });
      return Response.json({
        answer: "🚀 Deep plan started — research → drafts → critique → synthesis running in the background. Results land on your board and in the vault; progress pings your Telegram.",
        sources: [], usedKnowledge: false,
        command: { kind: "deepplan", id, status: "started" },
      });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return Response.json({ error: "Not configured (no ANTHROPIC_API_KEY)." }, { status: 503 });
      }
      console.error(`[chat] ${cmd.verb} command failed:`, err);
      return Response.json({ error: `Couldn't run ${cmd.verb}: — try again.` }, { status: 500 });
    }
  }
  if (cmd) question = cmd.arg; // ask: strips the prefix, then flows as chat

  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is ChatTurn =>
            !!t &&
            typeof t === "object" &&
            (t as ChatTurn).role !== undefined &&
            typeof (t as ChatTurn).content === "string"
        )
        .map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", content: t.content }))
    : [];

  try {
    const result = await answerQuestion(question, history);
    return Response.json(result);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return Response.json({ error: "Chat isn't configured (no ANTHROPIC_API_KEY)." }, { status: 503 });
    }
    console.error("[chat] failed:", err);
    return Response.json({ error: "Couldn't answer that — try again." }, { status: 500 });
  }
}

export async function GET() {
  const count = await chunkCount();
  return Response.json({ chunks: count });
}
