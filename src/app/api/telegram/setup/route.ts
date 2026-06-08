import { NextResponse } from "next/server";
import { setChatMenuButton } from "@/lib/telegram";
import { appUrl } from "@/lib/appUrl";

// One-time setup: points the bot's persistent menu button at the Mini App.
// Protect with the webhook secret: GET /api/telegram/setup?secret=...
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = `${appUrl()}/dashboard`;
  await setChatMenuButton(url, "Ilova");
  return NextResponse.json({ ok: true, menuButtonUrl: url });
}
