import "server-only";

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Sends a plain-text message via the Telegram Bot API. Never throws — failures
 * are logged so the webhook can always return 200 quickly.
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error(
        "Telegram sendMessage failed:",
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.error("Telegram sendMessage error:", err);
  }
}
