import { after } from "next/server";
import { kv } from "@/lib/redis";
import type { NextRequest } from "next/server";
import { newId, type Task } from "@/lib/types";
import { MissingApiKeyError } from "@/lib/classify";
import { splitBrainDump } from "@/lib/braindump";
import { draftFollowUp } from "@/lib/draft";
import { enqueuePendingNote } from "@/lib/obsidian";
import { sendTelegramMessage } from "@/lib/telegram";
import { planProject, planToTasks, planToNote } from "@/lib/planner";
import { jobKey, runDeepPlan, type DeepPlanJob } from "@/lib/deepPlanner";
import { getMode, setMode, telegramChat, clearTelegramChat } from "@/lib/tgchat";
import { ingestDocument } from "@/lib/knowledge";
import { answerQuestion } from "@/lib/chat";

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
  if (!expected) return false; // fail closed — a missing env var must not open the webhook
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

  // Restrict to the configured chat. The secret token already proves the update
  // came from Telegram's servers; this allowlist proves it came from YOU. Keep
  // /start and /id usable during setup so you can discover the id to configure.
  const allowed = process.env.TELEGRAM_CHAT_ID;
  const fromOk = Boolean(allowed) && String(chatId) === String(allowed);

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
      "💬 Chat mode on — I'll talk, nothing gets saved. Use `task:`, `plan:`, or `deepplan:` to capture, or `ask:` to query your knowledge base. /capture to switch back."
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

  // "ask: <question>" → answer from the knowledge base with citations.
  const askMatch = text.match(/^(?:\/ask|ask:)\s*([\s\S]+)$/i);
  if (askMatch) {
    const question = askMatch[1].trim();
    if (!question) {
      await sendTelegramMessage(chatId, "Ask me something, e.g. `ask: what did the academy plan say about pricing?`");
      return ok();
    }
    try {
      const { answer, sources, usedKnowledge } = await answerQuestion(question);
      const cites =
        usedKnowledge && sources.length
          ? "\n\n" + sources.map((s) => `[${s.n}] ${s.title}`).join("\n")
          : "";
      await sendTelegramMessage(chatId, `${answer}${cites}`);
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        await sendTelegramMessage(chatId, "⚠️ Chat isn't configured (no ANTHROPIC_API_KEY).");
      } else {
        await sendTelegramMessage(chatId, "Couldn't answer that — try again.");
      }
    }
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

  // "done", "done 1", "done 1 3", "done all" → check off items from the last
  // morning brief. Only intercepts when a brief exists and the message is just
  // "done" + numbers/all (so "done the laundry" still captures normally).
  const doneMatch = text.match(/^done\b\s*(all|[\d\s,]*)$/i);
  if (doneMatch) {
    const briefIds = (await kv.get<string[]>(`brief:last:${chatId}`)) ?? [];
    if (briefIds.length) {
      const arg = doneMatch[1].trim().toLowerCase();
      const idxs =
        arg === "" || arg === "all"
          ? briefIds.map((_, i) => i + 1)
          : (arg.match(/\d+/g) ?? []).map(Number);
      const toMark = new Set(idxs.map((n) => briefIds[n - 1]).filter(Boolean));
      const all = (await kv.get<Task[]>(KEY)) ?? [];
      let count = 0;
      const updated = all.map((t) => {
        if (toMark.has(t.id) && t.status !== "done") {
          count++;
          return { ...t, status: "done" as const };
        }
        return t;
      });
      await kv.set(KEY, updated);
      const stillOpen = briefIds.filter((id) => updated.find((t) => t.id === id)?.status !== "done").length;
      await sendTelegramMessage(
        chatId,
        count
          ? `✅ Marked ${count} done.${stillOpen ? ` ${stillOpen} left from this morning.` : " That's the brief cleared — nice."}`
          : "Those are already done (or not on this morning's brief)."
      );
      return ok();
    }
    // No brief on record — fall through and treat it as a normal capture.
  }

  // "draft 1" → write a follow-up in your voice for an item from the last
  // brief/nudge (great for deals/people going quiet).
  const draftMatch = text.match(/^draft\s+(\d+)$/i);
  if (draftMatch) {
    const briefIds = (await kv.get<string[]>(`brief:last:${chatId}`)) ?? [];
    const id = briefIds[Number(draftMatch[1]) - 1];
    const all = (await kv.get<Task[]>(KEY)) ?? [];
    const task = all.find((t) => t.id === id);
    if (!task) {
      await sendTelegramMessage(chatId, "Nothing at that number from the last brief/nudge.");
      return ok();
    }
    try {
      const body = await draftFollowUp(task);
      await sendTelegramMessage(chatId, `✍️ *${task.title}*\n\n${body}`);
    } catch (err) {
      await sendTelegramMessage(
        chatId,
        err instanceof MissingApiKeyError ? "⚠️ No ANTHROPIC_API_KEY." : "Couldn't draft that — try again."
      );
    }
    return ok();
  }

  // "deals" / "people" / "ideas" / "list meetings" → query the board by supertag.
  const listMatch = text.match(/^(?:list\s+)?(deals?|people|persons?|ideas?|errands?|meetings?|tasks?)$/i);
  if (listMatch) {
    const w = listMatch[1].toLowerCase();
    const type = w.startsWith("deal") ? "deal"
      : w.startsWith("pe") || w.startsWith("person") ? "person"
      : w.startsWith("idea") ? "idea"
      : w.startsWith("errand") ? "errand"
      : w.startsWith("meeting") ? "meeting"
      : "task";
    const all = (await kv.get<Task[]>(KEY)) ?? [];
    const matched = all.filter((t) => t.status !== "done" && (t.entityType ?? "task") === type);
    if (!matched.length) {
      await sendTelegramMessage(chatId, `No open ${type}s on your board.`);
      return ok();
    }
    const lines = matched
      .slice(0, 15)
      .map((t) => {
        const f = t.fields && Object.keys(t.fields).length
          ? " — " + Object.entries(t.fields).map(([k, v]) => `${k}: ${v}`).join(", ")
          : "";
        return `• *${t.title}*${f}`;
      })
      .join("\n");
    await sendTelegramMessage(chatId, `*${type[0].toUpperCase() + type.slice(1)}s (${matched.length}):*\n${lines}`);
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

  // Brain dump: split one message into every distinct item and classify each,
  // so a run-on becomes the right set of tasks instead of one blob.
  let items;
  try {
    items = await splitBrainDump(captureText, projects);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      await sendTelegramMessage(chatId, "⚠️ Classifier isn't configured (no ANTHROPIC_API_KEY).");
      return ok();
    }
    // Fall back to a plain task so nothing is lost if the split fails.
    const task: Task = {
      id: newId(), title: captureText, status: "todo", priority: "medium",
      createdAt: Date.now(), source: "telegram",
    };
    await kv.set(KEY, [task, ...tasks]);
    await sendTelegramMessage(chatId, `Added to your board: *${captureText}*`);
    return ok();
  }

  const now = Date.now();
  const single = items.length === 1;
  const newTasks: Task[] = items.map((c, i) => ({
    id: newId(),
    title: c.title,
    status: "todo",
    priority: c.priority,
    createdAt: now + (items.length - i), // preserve dump order (newest-first list)
    context: c.context,
    noteType: c.noteType,
    source: "telegram",
    entityType: c.entityType,
    ...(Object.keys(c.fields).length ? { fields: c.fields } : {}),
    ...(c.dueAt ? { dueAt: c.dueAt } : {}),
    ...(c.matchedProject ? { project: c.matchedProject } : {}),
  }));
  await kv.set(KEY, [...newTasks, ...tasks]);

  // Queue each note for Obsidian + file each in the knowledge base. For a single
  // capture keep the full original text; for a split use the item's own content.
  for (const c of items) {
    const body = single ? captureText : [c.title, c.summary].filter(Boolean).join(" — ");
    await enqueuePendingNote({ classification: c, text: body, at: Date.now() });
    await ingestDocument({
      title: c.title, content: body, sourceType: "telegram",
      sourceName: c.title, context: c.context, tags: [c.entityType, ...c.tags],
    });
  }

  const tag = (c: (typeof items)[number]) =>
    `${c.entityType !== "task" ? c.entityType + " · " : ""}${c.context}/${c.priority}${c.dueAt ? " · due " + new Date(c.dueAt).toISOString().slice(0, 10) : ""}`;

  if (single) {
    const c = items[0];
    const where = c.matchedProject ? ` → _${c.matchedProject}_` : "";
    await sendTelegramMessage(
      chatId,
      `✅ *${c.title}*\n${tag(c)}${where}\nOn your board and queued for Obsidian.`
    );
  } else {
    const lines = items.map((c) => `• *${c.title}* — ${tag(c)}`).join("\n");
    await sendTelegramMessage(
      chatId,
      `🧠 Captured *${items.length}* from that:\n${lines}\n\nAll on your board and queued for Obsidian.`
    );
  }

  return ok();
}
