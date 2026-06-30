import Anthropic from "@anthropic-ai/sdk";
import { MissingApiKeyError } from "./classify";
import type { NoteClassification, LifeContext } from "./notes";
import { newId, type Priority, type Task } from "./types";

// Project planner: turn a one-line idea into a structured plan — milestones,
// each with concrete tasks. Used by the Telegram "plan:" command and the
// dashboard's "Plan as project" action.

export interface PlanTask {
  title: string;
  priority: Priority;
}
export interface Milestone {
  name: string;
  tasks: PlanTask[];
}
export interface ProjectPlan {
  projectTitle: string;
  context: LifeContext;
  summary: string;
  milestones: Milestone[];
}

const SCHEMA = {
  type: "object",
  properties: {
    projectTitle: { type: "string", description: "A short project name (2-6 words)." },
    context: { type: "string", enum: ["personal", "work"] },
    summary: { type: "string", description: "One or two sentences on the goal." },
    milestones: {
      type: "array",
      description: "3-5 milestones in logical order, each a phase of the project.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Milestone name (e.g. 'Validation & design')." },
          tasks: {
            type: "array",
            description: "2-5 concrete, actionable tasks for this milestone.",
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

const CONTEXTS = ["personal", "work"];

export async function planProject(text: string): Promise<ProjectPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: SCHEMA },
    },
    system:
      "You are a planning assistant. Given a project idea, break it into a realistic, ordered set of milestones, each with a few concrete next-action tasks. Keep tasks small and doable. Front-load the work that de-risks the project. Be decisive about priorities.",
    messages: [{ role: "user", content: `Plan this project:\n"""\n${text}\n"""` }],
  });

  const block = response.content.find((b) => b.type === "text");
  const jsonText = block && block.type === "text" ? block.text : "";
  const plan = JSON.parse(jsonText) as ProjectPlan;

  plan.projectTitle = (plan.projectTitle || "").trim() || "Untitled project";
  plan.context = (CONTEXTS.includes(plan.context) ? plan.context : "personal") as LifeContext;
  plan.summary = plan.summary || "";
  plan.milestones = Array.isArray(plan.milestones) ? plan.milestones : [];
  return plan;
}

// Flatten a plan into board tasks, tagged with project + milestone.
export function planToTasks(plan: ProjectPlan, source: Task["source"] = "ui"): Task[] {
  const base = Date.now() * 1000;
  let i = 0;
  const tasks: Task[] = [];
  for (const m of plan.milestones) {
    for (const t of m.tasks) {
      tasks.push({
        id: newId(),
        title: t.title,
        status: "todo",
        priority: t.priority,
        createdAt: base + i++,
        context: plan.context,
        noteType: "current-project",
        source,
        project: plan.projectTitle,
        milestone: m.name,
      });
    }
  }
  return tasks;
}

// Build the Obsidian project page: a classification (for frontmatter + folder)
// and the milestone checklist as the note body.
export function planToNote(plan: ProjectPlan): { classification: NoteClassification; text: string } {
  const body = plan.milestones
    .map((m) => {
      const items = m.tasks
        .map((t) => `- [ ] ${t.title}${t.priority === "high" ? " ⏫" : ""}`)
        .join("\n");
      return `## ${m.name}\n${items}`;
    })
    .join("\n\n");

  const classification: NoteClassification = {
    noteType: "current-project",
    context: plan.context,
    priority: "medium",
    title: plan.projectTitle,
    summary: plan.summary,
    tags: ["project", "plan"],
    matchedProject: "",
  };
  return { classification, text: body };
}
