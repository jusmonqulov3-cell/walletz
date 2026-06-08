import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTashkentMonthInfo, getTashkentPeriods } from "@/lib/dates";

// Deterministic spending analysis shared by the dashboard and the Telegram
// crons: end-of-month forecast, budget runway, category anomalies, recurring
// charges, and a weekly recap. No AI — just arithmetic over the user's rows.

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 120;

// Anomaly thresholds: a category must be at least this many times its typical
// weekly spend AND exceed the baseline by this absolute amount to flag.
const ANOMALY_RATIO = 2;
const ANOMALY_MIN_DELTA = 100_000;

// Recurring: a label must appear in at least this many distinct months, with
// amounts within this tolerance of the median, to count as recurring.
const RECURRING_MIN_MONTHS = 2;
const RECURRING_TOLERANCE = 0.35;
const RECURRING_DUE_WINDOW_DAYS = 5;

type ExpenseRow = {
  note: string | null;
  amount: number;
  category: string | null;
  spent_at: string;
};

export type Forecast = {
  thisMonthTotal: number;
  projectedMonth: number;
  dailyPace: number;
  budget: number | null;
  budgetPct: number | null;
  remaining: number | null;
  runwayDays: number | null;
  daysRemaining: number;
};

export type Anomaly = {
  category: string;
  thisWeek: number;
  typicalWeek: number;
  ratio: number;
};

export type Recurring = {
  label: string;
  typicalAmount: number;
  typicalDay: number;
  monthsSeen: number;
  seenThisMonth: boolean;
  dueSoon: boolean;
};

export type WeeklyRecap = {
  lastWeekTotal: number;
  priorWeekTotal: number;
  changePct: number | null;
  topCategories: { category: string; total: number }[];
};

export type Insights = {
  forecast: Forecast;
  anomalies: Anomaly[];
  recurring: Recurring[];
  weekly: WeeklyRecap;
};

function num(v: unknown): number {
  return Number(v) || 0;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Tashkent wall-clock day-of-month for a UTC timestamp.
function tashDay(iso: string): number {
  return new Date(new Date(iso).getTime() + 5 * 3600 * 1000).getUTCDate();
}

function monthKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

function normalizeLabel(note: string | null): string {
  return (note ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function computeForecast(
  rows: ExpenseRow[],
  budget: number | null,
  now: Date,
): Forecast {
  const info = getTashkentMonthInfo(now);
  const { startOfMonth } = getTashkentPeriods(now);
  const thisMonthTotal = rows
    .filter((r) => r.spent_at >= startOfMonth)
    .reduce((s, r) => s + num(r.amount), 0);

  const dailyPace = info.dayOfMonth > 0 ? thisMonthTotal / info.dayOfMonth : 0;
  const projectedMonth = Math.round(dailyPace * info.daysInMonth);
  const remaining = budget != null ? budget - thisMonthTotal : null;
  const budgetPct =
    budget != null && budget > 0 ? thisMonthTotal / budget : null;
  const runwayDays =
    remaining != null && dailyPace > 0
      ? Math.max(0, Math.floor(remaining / dailyPace))
      : null;

  return {
    thisMonthTotal,
    projectedMonth,
    dailyPace: Math.round(dailyPace),
    budget,
    budgetPct,
    remaining,
    runwayDays,
    daysRemaining: info.daysRemaining,
  };
}

function computeAnomalies(rows: ExpenseRow[], now: Date): Anomaly[] {
  const { startOfWeek } = getTashkentPeriods(now);
  const weekStartMs = new Date(startOfWeek).getTime();
  const baselineStartMs = weekStartMs - 8 * 7 * DAY_MS;

  // This week's spend per category.
  const thisWeek = new Map<string, number>();
  // Baseline: per-category totals across the 8 prior full weeks.
  const baseTotal = new Map<string, number>();

  for (const r of rows) {
    const t = new Date(r.spent_at).getTime();
    const cat = r.category || "Boshqa";
    if (t >= weekStartMs) {
      thisWeek.set(cat, (thisWeek.get(cat) ?? 0) + num(r.amount));
    } else if (t >= baselineStartMs) {
      baseTotal.set(cat, (baseTotal.get(cat) ?? 0) + num(r.amount));
    }
  }

  const anomalies: Anomaly[] = [];
  for (const [cat, week] of thisWeek) {
    const typical = (baseTotal.get(cat) ?? 0) / 8; // avg per week over 8 weeks
    if (typical <= 0) continue;
    const ratio = week / typical;
    if (ratio >= ANOMALY_RATIO && week - typical >= ANOMALY_MIN_DELTA) {
      anomalies.push({
        category: cat,
        thisWeek: Math.round(week),
        typicalWeek: Math.round(typical),
        ratio: Math.round(ratio * 10) / 10,
      });
    }
  }
  return anomalies.sort((a, b) => b.ratio - a.ratio);
}

function computeRecurring(rows: ExpenseRow[], now: Date): Recurring[] {
  const thisMonth = monthKey(now.toISOString());
  const todayDay = tashDay(now.toISOString());

  // Group amounts and months by normalized label.
  type Group = {
    label: string;
    amounts: number[];
    months: Set<string>;
    days: number[];
  };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = normalizeLabel(r.note);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { label: (r.note ?? "").trim(), amounts: [], months: new Set(), days: [] };
      groups.set(key, g);
    }
    g.amounts.push(num(r.amount));
    g.months.add(monthKey(r.spent_at));
    g.days.push(tashDay(r.spent_at));
  }

  const out: Recurring[] = [];
  for (const g of groups.values()) {
    if (g.months.size < RECURRING_MIN_MONTHS) continue;
    const med = median(g.amounts);
    if (med <= 0) continue;
    // Amounts must be consistent (most within tolerance of the median).
    const consistent =
      g.amounts.filter((a) => Math.abs(a - med) <= med * RECURRING_TOLERANCE)
        .length /
        g.amounts.length >=
      0.6;
    if (!consistent) continue;

    const typicalDay = Math.round(median(g.days));
    const seenThisMonth = rows.some(
      (r) =>
        normalizeLabel(r.note) === normalizeLabel(g.label) &&
        monthKey(r.spent_at) === thisMonth,
    );
    const dueSoon =
      !seenThisMonth &&
      typicalDay >= todayDay &&
      typicalDay - todayDay <= RECURRING_DUE_WINDOW_DAYS;

    out.push({
      label: g.label,
      typicalAmount: Math.round(med),
      typicalDay,
      monthsSeen: g.months.size,
      seenThisMonth,
      dueSoon,
    });
  }
  // Most frequent / largest first.
  return out
    .sort((a, b) => b.monthsSeen - a.monthsSeen || b.typicalAmount - a.typicalAmount)
    .slice(0, 8);
}

function computeWeekly(rows: ExpenseRow[], now: Date): WeeklyRecap {
  const { startOfWeek } = getTashkentPeriods(now);
  const weekStartMs = new Date(startOfWeek).getTime();
  const lastWeekStart = weekStartMs - 7 * DAY_MS;
  const priorWeekStart = weekStartMs - 14 * DAY_MS;

  let lastWeekTotal = 0;
  let priorWeekTotal = 0;
  const byCat = new Map<string, number>();

  for (const r of rows) {
    const t = new Date(r.spent_at).getTime();
    if (t >= lastWeekStart && t < weekStartMs) {
      lastWeekTotal += num(r.amount);
      const cat = r.category || "Boshqa";
      byCat.set(cat, (byCat.get(cat) ?? 0) + num(r.amount));
    } else if (t >= priorWeekStart && t < lastWeekStart) {
      priorWeekTotal += num(r.amount);
    }
  }

  const changePct =
    priorWeekTotal > 0
      ? Math.round(((lastWeekTotal - priorWeekTotal) / priorWeekTotal) * 100)
      : null;

  const topCategories = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, total]) => ({ category, total: Math.round(total) }));

  return {
    lastWeekTotal: Math.round(lastWeekTotal),
    priorWeekTotal: Math.round(priorWeekTotal),
    changePct,
    topCategories,
  };
}

/**
 * Fetches the trailing window of expenses (+ latest overall budget) for one
 * user and computes all insights. Works with both the RLS-scoped server client
 * and the admin client — `userId` is always filtered explicitly.
 */
export async function buildInsights(
  client: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<Insights> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS).toISOString();

  const [expRes, budgetRes] = await Promise.all([
    client
      .from("expenses")
      .select("note, amount, category, spent_at")
      .eq("user_id", userId)
      .gte("spent_at", since),
    client
      .from("budgets")
      .select("monthly_limit")
      .eq("user_id", userId)
      .is("category", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = (expRes.data ?? []) as ExpenseRow[];
  const budget =
    budgetRes.data?.monthly_limit != null
      ? Number(budgetRes.data.monthly_limit)
      : null;

  return {
    forecast: computeForecast(rows, budget, now),
    anomalies: computeAnomalies(rows, now),
    recurring: computeRecurring(rows, now),
    weekly: computeWeekly(rows, now),
  };
}
