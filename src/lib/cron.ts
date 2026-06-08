import "server-only";
import type { InlineKeyboardMarkup } from "@/lib/telegram";
import { appUrl } from "@/lib/appUrl";

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We also accept a
// `?secret=` query so the job can be triggered manually for testing.
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

// "Open app" button attached to proactive messages.
export function openAppKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📊 Ilovani ochish", web_app: { url: `${appUrl()}/dashboard` } }],
    ],
  };
}
