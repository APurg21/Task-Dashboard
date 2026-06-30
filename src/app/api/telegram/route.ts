import { kv } from "@/lib/redis";
import type { NextRequest } from "next/server";
import { newId, type Task } from "@/lib/types";
import { classifyText, MissingApiKeyError } from "@/lib/classify";
import { enqueuePendingNote } from "@/lib/obsidian";
import { sendTelegramMessage } from "@/lib/telegram";
import { NOTE_TYPE_LABELS } from "@/lib/notes";

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

  // Pass current active task titles as project context for matching.
  const tasks = (await kv.get<Task[]>(KEY)) ?? [];
  const projects = tasks.filter((t) => t.status !== "done").map((t) => t.title);

  let classification;
  try {
    classification = await classifyText(text, projects);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      await sendTelegramMessage(chatId, "⚠️ Classifier isn't configured (no ANTHROPIC_API_KEY).");
      return ok();
    }
    // Fall back to a plain task so nothing is lost if classification fails.
    const task: Task = {
      id: newId(),
      title: text,
      status: "todo",
      priority: "medium",
      createdAt: Date.now(),
      source: "telegram",
    };
    await kv.set(KEY, [task, ...tasks]);
    await sendTelegramMessage(chatId, `Added to your board: *${text}*`);
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
  await enqueuePendingNote({ classification, text, at: Date.now() });

  const where = classification.matchedProject
    ? ` → _${classification.matchedProject}_`
    : "";
  await sendTelegramMessage(
    chatId,
    `✅ *${classification.title}*\n${NOTE_TYPE_LABELS[classification.noteType]} · ${classification.context} · ${classification.priority} priority${where}\nOn your board and queued for Obsidian.`
  );

  return ok();
}
