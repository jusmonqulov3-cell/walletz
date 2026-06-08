import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInsights } from "@/lib/insights";
import { weeklyDigest } from "@/lib/telegramDigest";
import { sendMessage } from "@/lib/telegram";
import { authorizeCron, openAppKeyboard } from "@/lib/cron";

export const maxDuration = 60;

// Weekly recap to opted-in users. Scheduled Monday morning (Tashkent).
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: links } = await admin
    .from("telegram_links")
    .select("telegram_id, user_id")
    .eq("notify", true);

  let sent = 0;
  for (const link of links ?? []) {
    try {
      const insights = await buildInsights(admin, link.user_id);
      const text = weeklyDigest(insights);
      if (!text) continue;
      await sendMessage(link.telegram_id, text, openAppKeyboard());
      sent += 1;
    } catch (err) {
      console.error("weekly digest error for", link.user_id, err);
    }
  }

  return NextResponse.json({ ok: true, recipients: links?.length ?? 0, sent });
}
