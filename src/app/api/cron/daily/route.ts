import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInsights } from "@/lib/insights";
import { dailyAlerts } from "@/lib/telegramDigest";
import { sendMessage } from "@/lib/telegram";
import { getTashkentMonthInfo, getTashkentPeriods } from "@/lib/dates";
import { authorizeCron, openAppKeyboard } from "@/lib/cron";

export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;

// Records that an alert was sent; returns true only if it wasn't already (a
// unique-constraint conflict means we've sent this exact alert before).
async function claim(
  admin: Admin,
  userId: string,
  kind: string,
  periodKey: string,
): Promise<boolean> {
  const { error } = await admin
    .from("telegram_notifications")
    .insert({ user_id: userId, kind, period_key: periodKey });
  return !error;
}

// Daily checks for opted-in users: budget thresholds, recurring-due reminders,
// and spending anomalies. Deduped so each alert fires at most once per period.
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthKey = getTashkentMonthInfo(now).today.slice(0, 7); // YYYY-MM
  const weekKey = getTashkentPeriods(now).startOfWeek.slice(0, 10); // YYYY-MM-DD

  const admin = createAdminClient();
  const { data: links } = await admin
    .from("telegram_links")
    .select("telegram_id, user_id")
    .eq("notify", true);

  let sent = 0;
  for (const link of links ?? []) {
    try {
      const insights = await buildInsights(admin, link.user_id, now);
      const alerts = dailyAlerts(insights, monthKey, weekKey);
      for (const a of alerts) {
        const fresh = await claim(admin, link.user_id, a.kind, a.periodKey);
        if (!fresh) continue;
        await sendMessage(link.telegram_id, a.text, openAppKeyboard());
        sent += 1;
      }
    } catch (err) {
      console.error("daily alerts error for", link.user_id, err);
    }
  }

  return NextResponse.json({ ok: true, recipients: links?.length ?? 0, sent });
}
