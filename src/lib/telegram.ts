import "server-only";

const TELEGRAM_API = "https://api.telegram.org";

export type InlineKeyboardButton = { text: string; callback_data: string };
export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

// Returns the bot token, or null (logged) when it isn't configured. Every
// helper below resolves this so a missing token degrades gracefully.
function botToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return null;
  }
  return token;
}

// POST a JSON body to a Bot API method. Never throws; logs on failure.
// Returns the parsed response JSON (or null) so callers can read result fields.
async function callApi(method: string, body: unknown): Promise<unknown> {
  const token = botToken();
  if (!token) return null;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`Telegram ${method} failed:`, res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Telegram ${method} error:`, err);
    return null;
  }
}

/**
 * Sends a plain-text message, optionally with an inline keyboard. Never throws —
 * failures are logged so the webhook can always return 200 quickly. Returns the
 * new message_id (so it can later be edited), or null on failure.
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<number | null> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const res = (await callApi("sendMessage", body)) as {
    result?: { message_id?: number };
  } | null;
  return res?.result?.message_id ?? null;
}

/**
 * Acknowledges a callback query (removes the button's loading spinner), with an
 * optional toast text. Never throws.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
  if (text) body.text = text;
  await callApi("answerCallbackQuery", body);
}

/**
 * Replaces the text (and optionally the inline keyboard) of an existing message.
 * Passing no replyMarkup removes the keyboard. Never throws.
 */
export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await callApi("editMessageText", body);
}

/**
 * Resolves a file_id to a downloadable URL via getFile. Returns null on failure.
 */
export async function getFileUrl(fileId: string): Promise<string | null> {
  const token = botToken();
  if (!token) return null;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!res.ok) {
      console.error("Telegram getFile failed:", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { result?: { file_path?: string } };
    const filePath = data.result?.file_path;
    if (!filePath) return null;
    return `${TELEGRAM_API}/file/bot${token}/${filePath}`;
  } catch (err) {
    console.error("Telegram getFile error:", err);
    return null;
  }
}

/**
 * Downloads a file URL and returns its bytes base64-encoded (no data: prefix).
 * Returns null on failure.
 */
export async function downloadFileAsBase64(
  fileUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) {
      console.error("Telegram file download failed:", res.status);
      return null;
    }
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error("Telegram file download error:", err);
    return null;
  }
}
