import { after } from "next/server";
import { kv } from "@/lib/redis";
import type { NextRequest } from "next/server";
import { newId, type Task } from "@/lib/types";
import { classifyText, MissingApiKeyError } from "@/lib/classify";
import { enqueuePendingNote } from "@/lib/obsidian";
import { sendTelegramMessage } from "@/lib/telegram";
import { NOTE_TYPE_LABELS } from "@/lib/notes";
import { planProject, planToTasks, planToNote } from "@/lib/planner";
import { jobKey, runDeepPlan, type DeepPlanJob } from "@/lib/deepPlanner";
import { getMode, setMode, telegramChat, clearTelegramChat } from "@/lib/tgchat";

// Allow the deep planner to run in the background after the webhook responds.
export const maxDuration = 300;

// Telegram webhook. You message your bot → this classifies the text, drops a
// prioritized task on the dashboard (shared Redis), queues the note for Obsidian
// sync, and replies to confirm. Telegram delivers updates here as JSON POSTs.

const KEY = "tasks";
const DIAG_KEY = "telegram:last";

// Telegram echoes back the secret token (set via setWebhook) in this header.
// That, plus the optional chat-id allowlist, is the security gate.
function secretValid(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_SECRET_TOKEN;
  if (!expected) return true; // not configured -> rely on allowlist below
  return req.headers.get("x-telegram-bot-api-secret-token") === expected;
}

const ok = () => new Response("ok"); // Telegram only needs a 200

export async function POST(req: NextRequest) {
  if (!secretValid(req)) return new Response("forbidden", { status: 403 });

  let update: {
    message?: { text?: string; chat?: { id?: number }; from?: { first_name?: string } };
  };
  try {
    update = await req.json();
  } catch {
    return ok();
  }

  const msg = update.message;
  const text = (msg?.text ?? "").trim();
  const chatId = msg?.chat?.id;
  if (!text || chatId === undefined) return ok();

  // Restrict to the configured chat. Unset -> accept any (rely on secret token).
  const allowed = process.env.TELEGRAM_CHAT_ID;
  const fromOk = !allowed || String(chatId) === String(allowed);

  await kv.set(DIAG_KEY, { chatId, text, fromOk, at: Date.now() });

  // /start and /id help during setup — they reveal the chat id to allowlist.
  if (text === "/start" || text === "/id") {
    await sendTelegramMessage(
      chatId,
      `Your chat ID is \`${chatId}\`.\nSet \`TELEGRAM_CHAT_ID=${chatId}\` in .env.local to lock the bot to you, then just text me anything and I'll triage it onto your dashboard.`
    );
    return ok();
  }

  if (!fromOk) {
    await sendTelegramMessage(chatId, "This bot is private.");
    return ok();
  }

  // Mode + chat commands.
  if (/^\/chat$/i.test(text)) {
    await setMode(chatId, "chat");
    await sendTelegramMessage(
      chatId,
      "💬 Chat mode on — I'll talk, nothing gets saved. Use `task:`, `plan:`, or `deepplan:` to capture. /capture to switch back."
    );
    return ok();
  }
  if (/^\/(capture|stop)$/i.test(text)) {
    await setMode(chatId, "capture");
    await sendTelegramMessage(chatId, "📥 Capture mode on — messages become tasks again.");
    return ok();
  }
  if (/^\/clear$/i.test(text)) {
    await clearTelegramChat(chatId);
    await sendTelegramMessage(chatId, "🧹 Chat history cleared.");
    return ok();
  }
  // One-off chat regardless of mode.
  const chatMatch = text.match(/^chat:\s*([\s\S]+)$/i);
  if (chatMatch) {
    await telegramChat(chatId, chatMatch[1].trim());
    return ok();
  }

  // "deepplan: <idea>" → multi-agent deep plan (runs in the background, texts
  // progress). Checked before plan: so it doesn't fall through to the quick path.
  const deepMatch = text.match(/^(?:\/deepplan|deepplan:)\s*([\s\S]+)$/i);
  if (deepMatch) {
    const idea = deepMatch[1].trim();
    if (!idea) {
      await sendTelegramMessage(chatId, "Tell me the project, e.g. `deepplan: launch a newsletter`.");
      return ok();
    }
    const id = newId();
    const job: DeepPlanJob = {
      id,
      idea,
      status: "queued",
      message: "Queued…",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await kv.set(jobKey(id), job);
    after(async () => {
      await runDeepPlan(id, idea, chatId);
    });
    return ok();
  }

  // "plan: <idea>" or "/plan <idea>" → break the idea into milestones + tasks.
  const planMatch = text.match(/^(?:\/plan|plan:)\s*([\s\S]+)$/i);
  if (planMatch) {
    const idea = planMatch[1].trim();
    if (!idea) {
      await sendTelegramMessage(chatId, "Tell me the project, e.g. `plan: build a personal website`.");
      return ok();
    }
    try {
      const plan = await planProject(idea);
      const planned = planToTasks(plan, "telegram");
      const existing = (await kv.get<Task[]>(KEY)) ?? [];
      await kv.set(KEY, [...planned, ...existing]);
      await enqueuePendingNote({ ...planToNote(plan), at: Date.now() });

      const outline = plan.milestones
        .map((m, i) => `*${i + 1}. ${m.name}* (${m.tasks.length})`)
        .join("\n");
      await sendTelegramMessage(
        chatId,
        `📋 *${plan.projectTitle}* — ${plan.milestones.length} milestones, ${planned.length} tasks\n\n${outline}\n\nOn your board and queued for Obsidian.`
      );
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        await sendTelegramMessage(chatId, "⚠️ Planner isn't configured (no ANTHROPIC_API_KEY).");
      } else {
        await sendTelegramMessage(chatId, "Couldn't build the plan — try again.");
      }
    }
    return ok();
  }

  // "task: <x>" forces capture even in chat mode; otherwise, in chat mode we
  // converse instead of saving.
  const taskMatch = text.match(/^(?:\/task|task:)\s*([\s\S]+)$/i);
  if (!taskMatch && (await getMode(chatId)) === "chat") {
    await telegramChat(chatId, text);
    return ok();
  }
  const captureText = taskMatch ? taskMatch[1].trim() : text;

  // Pass current active task titles as project context for matching.
  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  const projects = tasks.filter((t) => t.status !== "done").map((t) => t.title);

  let classification;
  try {
    classification = await classifyText(captureText, projects);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      await sendTelegramMessage(chatId, "⚠️ Classifier isn't configured (no ANTHROPIC_API_KEY).");
      return ok();
    }
    // Fall back to a plain task so nothing is lost if classification fails.
    const task: Task = {
      id: newId(),
      title: captureText,
      status: "todo",
      priority: "medium",
      createdAt: Date.now(),
      source: "telegram",
    };
    await kv.set(KEY, [task, ...tasks]);
    await sendTelegramMessage(chatId, `Added to your board: *${captureText}*`);
    return ok();
  }

  // Create the dashboard task.
  const task: Task = {
    id: newId(),
    title: classification.title,
    status: "todo",
    priority: classification.priority,
    createdAt: Date.now(),
    context: classification.context,
    noteType: classification.noteType,
    source: "telegram",
  };
  await kv.set(KEY, [task, ...tasks]);

  // Queue the note for Obsidian — flushed by the local app's sync.
  await enqueuePendingNote({ classification, text: captureText, at: Date.now() });

  const where = classification.matchedProject
    ? ` → _${classification.matchedProject}_`
    : "";
  await sendTelegramMessage(
    chatId,
    `✅ *${classification.title}*\n${NOTE_TYPE_LABELS[classification.noteType]} · ${classification.context} · ${classification.priority} priority${where}\nOn your board and queued for Obsidian.`
  );

  return ok();
}
