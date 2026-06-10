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

/** Today as YYYY-MM-DD anchored to Asia/Tashkent. */
export function todayYmd(now: Date = new Date()): string {
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The YYYY-MM-DD (Tashkent) that is `daysAgo` whole days before today. Used to
 * seed the date picker when the parser reports a backdated entry.
 */
export function ymdDaysAgo(daysAgo: number, now: Date = new Date()): string {
  const d = Math.max(0, Math.min(366, Math.round(Number(daysAgo) || 0)));
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS - d * DAY_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Resolves a YYYY-MM-DD (Tashkent calendar day) into the UTC ISO instant to
 * store in `spent_at` / `received_at`. Today keeps the live `now()` so fresh
 * entries sort newest-first; any other day is anchored to 12:00 Tashkent, well
 * clear of the midnight boundary so the row lands on the intended calendar day.
 * Returns null for a missing/invalid date or one in the future.
 */
export function isoForYmd(
  ymd: unknown,
  now: Date = new Date(),
): string | null {
  if (typeof ymd !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;

  const today = todayYmd(now);
  if (ymd.trim() === today) return now.toISOString();

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  // Noon Tashkent on that day, expressed as the real UTC instant.
  const noonLocalMs = Date.UTC(y, m - 1, d, 12, 0, 0);
  if (!Number.isFinite(noonLocalMs)) return null;
  const iso = new Date(noonLocalMs - TASHKENT_OFFSET_MS);
  // Reject future dates (a small skew allowance covers clock drift).
  if (iso.getTime() > now.getTime() + DAY_MS) return null;
  return iso.toISOString();
}

/** Resolves a relative `daysAgo` count directly into a storable UTC ISO. */
export function isoFromDaysAgo(
  daysAgo: number,
  now: Date = new Date(),
): string {
  return isoForYmd(ymdDaysAgo(daysAgo, now), now) ?? now.toISOString();
}

/**
 * Short Uzbek label for a backdated entry ("kecha", "2 kun oldin"). Empty
 * string when the entry is for today, so callers can append it conditionally.
 */
export function daysAgoLabel(daysAgo: number): string {
  const d = Math.max(0, Math.round(Number(daysAgo) || 0));
  if (d === 0) return "";
  if (d === 1) return "kecha";
  return `${d} kun oldin`;
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
