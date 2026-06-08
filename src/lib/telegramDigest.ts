import "server-only";
import { formatAmount } from "@/lib/format";
import type { Insights } from "@/lib/insights";

// Builds the Uzbek text for proactive Telegram notifications from computed
// insights. The bot's primary language is Uzbek, and crons have no app-locale
// cookie, so these stay Uzbek.

export type Alert = { kind: string; periodKey: string; text: string };

// Weekly recap — returns null when there was no spend to report last week.
export function weeklyDigest(insights: Insights): string | null {
  const w = insights.weekly;
  if (w.lastWeekTotal <= 0) return null;

  const lines = ["📅 Haftalik hisobot"];
  let spend = `Xarajat: ${formatAmount(w.lastWeekTotal)}`;
  if (w.changePct != null) {
    spend += ` (${w.changePct >= 0 ? "↑" : "↓"}${Math.abs(w.changePct)}%)`;
  }
  lines.push(spend);

  if (w.topCategories.length) {
    lines.push(`Top: ${w.topCategories.map((c) => c.category).join(", ")}`);
  }
  const pct = insights.forecast.budgetPct;
  if (pct != null) {
    lines.push(`Oylik byudjet: ${Math.round(pct * 100)}% ishlatilgan`);
  }
  return lines.join("\n");
}

// Daily alerts — budget thresholds, recurring-due reminders, spending spikes.
// Each carries a (kind, periodKey) so the cron can dedup before sending.
export function dailyAlerts(
  insights: Insights,
  monthKey: string,
  weekKey: string,
): Alert[] {
  const alerts: Alert[] = [];
  const f = insights.forecast;

  if (f.budgetPct != null) {
    if (f.budgetPct >= 1) {
      alerts.push({
        kind: "budget100",
        periodKey: monthKey,
        text: `⚠️ Oylik byudjet tugadi (100%)\nBu oy: ${formatAmount(f.thisMonthTotal)}`,
      });
    } else if (f.budgetPct >= 0.8) {
      const rem =
        f.remaining != null ? formatAmount(Math.max(0, f.remaining)) : "—";
      alerts.push({
        kind: "budget80",
        periodKey: monthKey,
        text: `⚠️ Oylik byudjetning 80% ishlatildi\nQoldi: ${rem}, ${f.daysRemaining} kun`,
      });
    }
  }

  for (const r of insights.recurring) {
    if (!r.dueSoon) continue;
    alerts.push({
      kind: "recurring",
      periodKey: `${r.label.toLowerCase()}:${monthKey}`,
      text: `🔁 Takroriy to'lov\nOdatda shu kunlarda: ${r.label}\n~${formatAmount(r.typicalAmount)}`,
    });
  }

  for (const a of insights.anomalies) {
    alerts.push({
      kind: "anomaly",
      periodKey: `${a.category}:${weekKey}`,
      text: `📈 G'ayrioddiy xarajat\n"${a.category}" bu hafta ${a.ratio}× ko'p\n${formatAmount(a.thisWeek)}`,
    });
  }

  return alerts;
}
