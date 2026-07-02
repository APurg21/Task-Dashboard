import Anthropic from "@anthropic-ai/sdk";
import { MissingApiKeyError } from "./classify";
import { getChiefStyle } from "./chat";
import type { Task } from "./types";

// Draft a ready-to-send follow-up / outreach for a task, deal, or person — in
// the user's voice. Returns just the message body, copy-paste ready.
export async function draftFollowUp(task: Task): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError("ANTHROPIC_API_KEY is not set.");

  const voice = await getChiefStyle();
  const client = new Anthropic({ apiKey });
  const fields = task.fields
    ? Object.entries(task.fields).map(([k, v]) => `${k}: ${v}`).join(" · ")
    : "";
  const kind = task.entityType || "task";

  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    output_config: { effort: "low" },
    system:
      "You draft short, ready-to-send messages for the user. Return ONLY the message body — no preamble, no 'here's a draft', no subject line unless it's clearly an email. Sound natural and human, not corporate." +
      (voice ? `\n\nMatch the user's voice:\n${voice}` : ""),
    messages: [
      {
        role: "user",
        content:
          `Draft a follow-up for this ${kind}:\nTitle: ${task.title}\n` +
          (fields ? `Details: ${fields}\n` : "") +
          (kind === "deal" || kind === "person"
            ? "Write the actual message I can send them — warm, specific, with a clear ask."
            : "Give me the next-step message or note to move this forward."),
      },
    ],
  });

  return (
    res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim() || "(couldn't draft that — try again)"
  );
}
