import Anthropic from "@anthropic-ai/sdk";
import { kv } from "./redis";
import { MissingApiKeyError } from "./classify";
import type { ProjectPlan } from "./planner";
import { planToTasks } from "./planner";
import { enqueuePendingNote } from "./obsidian";
import { sendTelegramMessage } from "./telegram";
import { safeFileName, type NoteClassification, type LifeContext } from "./notes";
import type { Task } from "./types";

// Deep planner: a multi-agent pipeline that turns one idea into a rigorous plan.
// intake → research (web) → 3 parallel drafts → critique → synthesize → land.
// Runs in the background (via the route's after()), writes progress to Redis,
// and texts the user on Telegram as it goes.

const TASKS_KEY = "tasks";
export const jobKey = (id: string) => `deepplan:${id}`;

export type DeepStatus =
  | "queued"
  | "scoping"
  | "researching"
  | "drafting"
  | "reviewing"
  | "synthesizing"
  | "saving"
  | "done"
  | "error";

export interface DeepPlanJob {
  id: string;
  idea: string;
  status: DeepStatus;
  message: string;
  plan?: ProjectPlan;
  taskCount?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export async function getJob(id: string): Promise<DeepPlanJob | null> {
  return kv.get<DeepPlanJob>(jobKey(id));
}

const SYNTH_SCHEMA = {
  type: "object",
  properties: {
    projectTitle: { type: "string" },
    context: { type: "string", enum: ["personal", "work"] },
    summary: { type: "string", description: "Two or three sentences on the goal and the chosen approach." },
    milestones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "A specific action (3-8 words)." },
                priority: { type: "string", enum: ["low", "medium", "high"] },
              },
              required: ["title", "priority"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "tasks"],
        additionalProperties: false,
      },
    },
  },
  required: ["projectTitle", "context", "summary", "milestones"],
  additionalProperties: false,
} as const;

const MODEL = "claude-sonnet-5";

function textOf(res: Anthropic.Message): string {
  return res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
}

async function ask(
  client: Anthropic,
  system: string,
  prompt: string,
  effort: "low" | "medium" | "high",
  maxTokens = 4096
): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { effort },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return textOf(res);
}

// Research with the web-search server tool; handles the pause_turn resume loop.
// max_uses caps searches so the stage stays well under platform time limits.
async function research(client: Anthropic, idea: string, brief: string): Promise<string> {
  const tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 3 } as const];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Ground this project in current reality so a plan can be realistic. Do at most a few targeted searches, then stop. Find concrete options, tools/platforms/services, ballpark costs, timelines, and common pitfalls. Prefer recent, specific facts over generalities.\n\nProject: "${idea}"\n\nContext brief:\n${brief}\n\nReturn a concise bullet-point digest. No preamble.`,
    },
  ];
  let out = "";
  try {
    for (let i = 0; i < 2; i++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        output_config: { effort: "low" },
        tools,
        messages,
      });
      out = textOf(res);
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content });
        continue;
      }
      break;
    }
  } catch {
    out = "(Research step unavailable — planning from model knowledge.)";
  }
  return out || "(No research returned.)";
}

interface Notifier {
  set: (status: DeepStatus, message: string, extra?: Partial<DeepPlanJob>) => Promise<void>;
  tg: (message: string) => Promise<void>;
}

export interface Attachment {
  name: string;
  text: string;
}

export async function runDeepPlan(
  jobId: string,
  idea: string,
  chatId?: number | string,
  attachment?: Attachment
): Promise<void> {
  const createdAt = (await getJob(jobId))?.createdAt ?? Date.now();
  const tgTarget = chatId ?? process.env.TELEGRAM_CHAT_ID;

  // Attached file becomes the primary material the agents work on.
  const att =
    attachment && attachment.text.trim()
      ? `\n\nAttached file "${attachment.name}" — treat this as the primary material to analyze:\n"""\n${attachment.text.slice(0, 24000)}\n"""`
      : "";

  const notify: Notifier = {
    set: async (status, message, extra = {}) => {
      const job: DeepPlanJob = { id: jobId, idea, status, message, createdAt, updatedAt: Date.now(), ...extra };
      await kv.set(jobKey(jobId), job);
    },
    tg: async (message) => {
      if (tgTarget) await sendTelegramMessage(tgTarget, message);
    },
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await notify.set("error", "Classifier not configured", { error: "ANTHROPIC_API_KEY is not set." });
    await notify.tg("⚠️ Deep planner isn't configured (no ANTHROPIC_API_KEY).");
    return;
  }
  const client = new Anthropic({ apiKey });

  try {
    await notify.set("scoping", "Scoping the project…");
    await notify.tg(`🧠 Deep-planning *${idea}* — scoping and researching now. I'll text you when it's ready.`);

    const brief = await ask(
      client,
      "You scope a project before planning. Be concise and decisive.",
      `Turn this into a short brief: the goal, the likely audience/owner, key constraints, and 3-5 explicit ASSUMPTIONS you're making (since you can't ask questions). Idea: "${idea}"${att}`,
      "low"
    );

    await notify.set("researching", "Researching current best practices…");
    const digest = await research(client, idea, brief);

    await notify.set("drafting", "Drafting 3 approaches in parallel…");
    const lenses = [
      "the fastest realistic path to a first concrete result",
      "the most thorough and robust approach, built to last",
      "the most resource-efficient approach (low cost, minimal tools)",
    ];
    const drafts = await Promise.all(
      lenses.map((lens, i) =>
        ask(
          client,
          `You are planner #${i + 1} of 3. Draft a distinct project plan optimized for ${lens}. Commit fully to this lens so the three drafts differ. Use phases with concrete steps.`,
          `Idea: "${idea}"\n\nBrief:\n${brief}\n\nResearch:\n${digest}${att}\n\nWrite your plan as phases, each with concrete actions. Note any key risks.`,
          "medium"
        )
      )
    );

    await notify.set("reviewing", "Red-teaming the drafts…");
    const critique = await ask(
      client,
      "You are a sharp critic. Find what's missing, unrealistic, mis-sequenced, or risky across the drafts. Be specific and actionable.",
      `Idea: "${idea}"\n\nResearch:\n${digest}\n\n${drafts
        .map((d, i) => `=== Draft ${i + 1} ===\n${d}`)
        .join("\n\n")}\n\nList the strongest ideas worth keeping, the gaps/risks to fix, and the right ordering of work.`,
      "medium"
    );

    await notify.set("synthesizing", "Synthesizing the final plan…");
    const synthRes = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      output_config: { effort: "high", format: { type: "json_schema", schema: SYNTH_SCHEMA } },
      system:
        "You synthesize one rigorous, well-sequenced project plan from multiple drafts and a critique. Merge the best ideas, fix the gaps, order milestones so each unblocks the next, and keep tasks concrete and doable. Be decisive about priorities.",
      messages: [
        {
          role: "user",
          content: `Idea: "${idea}"\n\nBrief:\n${brief}\n\nResearch:\n${digest}${att}\n\nDrafts:\n${drafts
            .map((d, i) => `--- Draft ${i + 1} ---\n${d}`)
            .join("\n\n")}\n\nCritique:\n${critique}\n\nProduce the final plan.`,
        },
      ],
    });
    const plan = JSON.parse(textOf(synthRes)) as ProjectPlan;
    plan.projectTitle = (plan.projectTitle || "").trim() || "Untitled project";
    plan.context = (["personal", "work"].includes(plan.context) ? plan.context : "personal") as LifeContext;
    plan.milestones = Array.isArray(plan.milestones) ? plan.milestones : [];

    await notify.set("saving", "Saving to your board and vault…", { plan });

    // Land on the board.
    const tasks = planToTasks(plan, "deep");
    const existing = (await kv.get<Task[]>(TASKS_KEY)) ?? [];
    await kv.set(TASKS_KEY, [...tasks, ...existing]);

    // Rich Obsidian project page: research + plan checklist.
    await enqueuePendingNote({ ...buildDeepNote(plan, digest, idea), at: Date.now() });

    await notify.set("done", "Done.", { plan, taskCount: tasks.length });

    const outline = plan.milestones.map((m, i) => `${i + 1}. ${m.name} (${m.tasks.length})`).join("\n");
    await notify.tg(
      `✅ *${plan.projectTitle}* — ${plan.milestones.length} milestones, ${tasks.length} tasks\n\n${outline}\n\nOn your board (Projects view) and queued for Obsidian.`
    );
  } catch (err) {
    const message = err instanceof MissingApiKeyError ? "No ANTHROPIC_API_KEY." : err instanceof Error ? err.message : "Deep plan failed.";
    await notify.set("error", "Failed", { error: message });
    await notify.tg(`⚠️ Couldn't finish the deep plan: ${message}`);
  }
}

function buildDeepNote(
  plan: ProjectPlan,
  research: string,
  idea: string
): { classification: NoteClassification; text: string } {
  const planBody = plan.milestones
    .map((m) => {
      const items = m.tasks.map((t) => `- [ ] ${t.title}${t.priority === "high" ? " ⏫" : ""}`).join("\n");
      return `### ${m.name}\n${items}`;
    })
    .join("\n\n");

  const text = [
    `**Idea:** ${idea}`,
    "",
    "## Research",
    research,
    "",
    "## Plan",
    planBody,
  ].join("\n");

  const classification: NoteClassification = {
    noteType: "current-project",
    context: plan.context,
    priority: "medium",
    title: safeFileName(plan.projectTitle),
    summary: plan.summary,
    tags: ["project", "deep-plan"],
    matchedProject: "",
  };
  return { classification, text };
}
