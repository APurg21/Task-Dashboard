// Thin Telegram Bot API helper. Used by the webhook to reply to messages and,
// later, to push proactive reminders to your phone.

export async function sendTelegramMessage(
  chatId: number | string,
  text: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort — never let a failed reply break the webhook.
  }
}
