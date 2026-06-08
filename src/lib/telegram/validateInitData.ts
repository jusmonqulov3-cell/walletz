import "server-only";
import crypto from "node:crypto";

// The subset of the Telegram WebApp user we rely on.
export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

// Reject initData older than this (replay protection).
const MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Verifies the `initData` query string Telegram passes to a Mini App, using the
 * bot token, per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns the authenticated user, or null if the signature/freshness check fails.
 * NEVER trust `initDataUnsafe` from the client — always validate here.
 */
export function validateInitData(initData: string): TelegramWebAppUser | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  // data_check_string: every remaining "key=value" (decoded), sorted, '\n'-joined.
  const pairs: string[] = [];
  for (const [key, value] of params) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(token)
    .digest();
  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // Freshness.
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  // Parse the user object.
  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as TelegramWebAppUser;
    return typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}
