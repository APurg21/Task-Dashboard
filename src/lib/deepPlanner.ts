import Anthropic from "@anthropic-ai/sdk";
import { kv } from "./redis";
import { MissingApiKeyError } from "./classify";
import type { ProjectPlan, Milestone } from "./planner";
import { planToTasks } from "./planner";
import { enqueuePendingNote } from "./obsidian";
import { sendTelegramMessage } from "./telegram";
import { safeFileName, type NoteClassification, type LifeContext } from "./notes";
import type { Task, Priority } from "./types";

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

export interface DeepDeliverable {
  title: string;
  content: string;
}

export interface DeepPlanJob {
  id: string;
  idea: string;
  status: DeepStatus;
  message: string;
  plan?: ProjectPlan;
  taskCount?: number;
  deliverables?: DeepDeliverable[];
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
                owner: {
                  type: "string",
                  enum: ["ai", "you"],
                  description:
                    "ai = knowledge work the assistant can do now with no external accounts or human judgment (research, analysis, summarizing, drafting text, organizing, comparing options). you = needs the human: calls, meetings, decisions, purchases, approvals, physical actions, or anything needing the user's accounts, relationships, or judgment.",
                },
              },
              required: ["title", "priority", "owner"],
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

// The assistant executes its own tasks and returns the finished work.
const DELIVERABLES_SCHEMA = {
  type: "object",
  properties: {
    deliverables: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "The task this delivers." },
          content: { type: "string", description: "The actual result — findings, analysis, or draft. Concrete and useful." },
        },
        required: ["title", "content"],
        additionalProperties: false,
      },
    },
  },
  required: ["deliverables"],
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
    // Parse the synthesized plan (each task tagged owner ai/you).
    type RawTask = { title: string; priority: Priority; owner?: string };
    type RawMilestone = { name: string; tasks: RawTask[] };
    const raw = JSON.parse(textOf(synthRes)) as {
      projectTitle?: string;
      context?: string;
      summary?: string;
      milestones?: RawMilestone[];
    };
    const projectTitle = (raw.projectTitle || "").trim() || "Untitled project";
    const context = (["personal", "work"].includes(raw.context || "") ? raw.context : "personal") as LifeContext;
    const summary = raw.summary || "";
    const rawMilestones = Array.isArray(raw.milestones) ? raw.milestones : [];

    // Human tasks go on the board; AI tasks get executed below.
    const humanMilestones: Milestone[] = rawMilestones
      .map((m) => ({
        name: m.name,
        tasks: (m.tasks || [])
          .filter((t) => t.owner !== "ai")
          .map((t) => ({ title: t.title, priority: t.priority })),
      }))
      .filter((m) => m.tasks.length > 0);
    const aiTasks = rawMilestones.flatMap((m) =>
      (m.tasks || []).filter((t) => t.owner === "ai").map((t) => t.title)
    );
    const humanPlan: ProjectPlan = { projectTitle, context, summary, milestones: humanMilestones };

    // Execute the AI-owned tasks and produce real deliverables.
    let deliverables: DeepDeliverable[] = [];
    if (aiTasks.length > 0) {
      await notify.set("saving", `Doing ${aiTasks.length} item${aiTasks.length === 1 ? "" : "s"} myself…`);
      try {
        const execRes = await client.messages.create({
          model: MODEL,
          max_tokens: 16000,
          output_config: { effort: "medium", format: { type: "json_schema", schema: DELIVERABLES_SCHEMA } },
          system:
            "You are now EXECUTING these knowledge-work tasks yourself, not planning them. For each task, produce the actual deliverable — the research findings, the analysis, the draft copy — concise but specific and genuinely useful. Ground it in the research and any attached file. If a task can't be fully finished without human input or external access, do as much as you can and clearly note what remains.",
          messages: [
            {
              role: "user",
              content: `Project: "${projectTitle}"\n\nBrief:\n${brief}\n\nResearch:\n${digest}${att}\n\nExecute each of these now and deliver the result:\n${aiTasks
                .map((t, i) => `${i + 1}. ${t}`)
                .join("\n")}`,
            },
          ],
        });
        const parsed = JSON.parse(textOf(execRes)) as { deliverables?: DeepDeliverable[] };
        deliverables = Array.isArray(parsed.deliverables) ? parsed.deliverables : [];
      } catch {
        // If execution fails, don't lose the work — drop them onto the board.
        const bucket = humanPlan.milestones.find((m) => m.name === "AI to-do") ?? {
          name: "AI to-do",
          tasks: [] as { title: string; priority: Priority }[],
        };
        if (!humanPlan.milestones.includes(bucket)) humanPlan.milestones.push(bucket);
        for (const t of aiTasks) bucket.tasks.push({ title: t, priority: "medium" });
      }
    }

    await notify.set("saving", "Saving to your board and vault…", { plan: humanPlan });

    // Land the human tasks on the board.
    const tasks = planToTasks(humanPlan, "deep");
    const existing = (await kv.get<Task[]>(TASKS_KEY)) ?? [];
    await kv.set(TASKS_KEY, [...tasks, ...existing]);

    // Obsidian project page: research + what I did + your tasks.
    await enqueuePendingNote({ ...buildDeepNote(humanPlan, digest, idea, deliverables), at: Date.now() });

    await notify.set("done", "Done.", { plan: humanPlan, taskCount: tasks.length, deliverables });

    const didList = deliverables.length
      ? `\n\n*I completed ${deliverables.length} myself:*\n${deliverables.map((d) => `• ${d.title}`).join("\n")}`
      : "";
    const yourList = tasks.length
      ? `\n\n*Your tasks (${tasks.length}):*\n${humanPlan.milestones.map((m, i) => `${i + 1}. ${m.name} (${m.tasks.length})`).join("\n")}`
      : "\n\nNothing needs you right now.";
    await notify.tg(`✅ *${projectTitle}*${didList}${yourList}\n\nFull results + plan queued for Obsidian.`);
  } catch (err) {
    const message = err instanceof MissingApiKeyError ? "No ANTHROPIC_API_KEY." : err instanceof Error ? err.message : "Deep plan failed.";
    await notify.set("error", "Failed", { error: message });
    await notify.tg(`⚠️ Couldn't finish the deep plan: ${message}`);
  }
}

function buildDeepNote(
  plan: ProjectPlan,
  research: string,
  idea: string,
  deliverables: DeepDeliverable[] = []
): { classification: NoteClassification; text: string } {
  const planBody = plan.milestones
    .map((m) => {
      const items = m.tasks.map((t) => `- [ ] ${t.title}${t.priority === "high" ? " ⏫" : ""}`).join("\n");
      return `### ${m.name}\n${items}`;
    })
    .join("\n\n");

  const deliverablesBody = deliverables.length
    ? deliverables.map((d) => `### ${d.title}\n${d.content}`).join("\n\n")
    : "";

  const text = [
    `**Idea:** ${idea}`,
    "",
    "## Research",
    research,
    ...(deliverablesBody ? ["", "## Delivered by AI", deliverablesBody] : []),
    "",
    "## Your tasks",
    planBody || "(none — nothing needs you right now)",
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
