// Asia/Tashkent is a fixed UTC+5 offset year-round (Uzbekistan has observed no
// DST since 1992), so we can compute local-day boundaries by shifting a constant
// rather than pulling in a timezone library. Week starts on Monday.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TashkentPeriods = {
  /** UTC instant of 00:00 Tashkent today */
  startOfToday: string;
  /** UTC instant of 00:00 Tashkent on the most recent Monday */
  startOfWeek: string;
  /** UTC instant of 00:00 Tashkent on the 1st of the current month */
  startOfMonth: string;
  /** First day of the current month as YYYY-MM-DD (Tashkent) */
  periodStart: string;
};

/**
 * Returns the start-of-today / week / month boundaries as UTC ISO strings,
 * anchored to Asia/Tashkent wall-clock time. `spent_at` is stored in UTC, so
 * comparing against these instants keeps totals from drifting across midnight.
 */
export function getTashkentPeriods(now: Date = new Date()): TashkentPeriods {
  // Reading getUTC* on the shifted date yields Tashkent wall-clock components.
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const dow = local.getUTCDay(); // 0 = Sunday … 6 = Saturday

  // Tashkent midnight expressed in the "UTC ms" frame, then shifted back to the
  // real UTC instant by subtracting the offset.
  const todayLocalMidnight = Date.UTC(y, m, d);
  const monthLocalMidnight = Date.UTC(y, m, 1);
  const daysSinceMonday = (dow + 6) % 7; // Mon→0, Sun→6

  const toUtcIso = (localMidnightMs: number) =>
    new Date(localMidnightMs - TASHKENT_OFFSET_MS).toISOString();

  return {
    startOfToday: toUtcIso(todayLocalMidnight),
    startOfWeek: toUtcIso(todayLocalMidnight - daysSinceMonday * DAY_MS),
    startOfMonth: toUtcIso(monthLocalMidnight),
    periodStart: `${y}-${String(m + 1).padStart(2, "0")}-01`,
  };
}

export type TashkentMonthInfo = {
  /** UTC instant of the 1st of this month (Tashkent) */
  startOfMonth: string;
  /** UTC instant of the 1st of last month (Tashkent) */
  startOfLastMonth: string;
  /** UTC instant of the 1st of this month — exclusive upper bound for last month */
  endOfLastMonth: string;
  /** Today as YYYY-MM-DD (Tashkent) */
  today: string;
  /** Day-of-month / days elapsed (1-based) */
  dayOfMonth: number;
  /** Total days in the current month */
  daysInMonth: number;
  /** Days remaining in the current month (excluding today) */
  daysRemaining: number;
};

/**
 * Month-level boundaries and day counts for this/last month, anchored to
 * Asia/Tashkent. Used to build the AI chat's financial context.
 */
export function getTashkentMonthInfo(now: Date = new Date()): TashkentMonthInfo {
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();

  const toUtcIso = (localMidnightMs: number) =>
    new Date(localMidnightMs - TASHKENT_OFFSET_MS).toISOString();

  const startOfMonthMs = Date.UTC(y, m, 1);
  const startOfLastMonthMs = Date.UTC(y, m - 1, 1); // JS normalizes Jan → prev Dec
  // Day 0 of next month = last day of this month.
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  return {
    startOfMonth: toUtcIso(startOfMonthMs),
    startOfLastMonth: toUtcIso(startOfLastMonthMs),
    endOfLastMonth: toUtcIso(startOfMonthMs),
    today: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    dayOfMonth: d,
    daysInMonth,
    daysRemaining: daysInMonth - d,
  };
}
