// Thin Telegram Bot API helper. Used by the webhook to reply to messages and
// by the brief/nudge crons to push proactive reminders to your phone.

export async function sendTelegramMessage(
  chatId: number | string,
  text: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const send = (parseMode?: string) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });

  try {
    const res = await send("Markdown");
    if (!res.ok) {
      // Markdown parse failures (task titles with *, _, [, `) return 400 and the
      // message silently never arrives. Retry as plain text so it still lands.
      const retry = await send();
      if (!retry.ok) {
        console.error(
          `[telegram] send failed: ${res.status} then ${retry.status} — ${await retry
            .text()
            .then((t) => t.slice(0, 200))
            .catch(() => "")}`
        );
      }
    }
  } catch (err) {
    // Best-effort — never let a failed reply break the webhook. But do log it.
    console.error("[telegram] send error:", err);
  }
}
