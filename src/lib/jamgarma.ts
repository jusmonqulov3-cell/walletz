// Jamg'arma (savings deposit) accrual.
//
// The principal compounds DAILY at annualRate/365. `created_at` is the accrual
// anchor — NOT just a creation timestamp — so the deposit shows what it's
// earning right now (down to the day). A "top-up" capitalizes the interest
// earned so far into the principal and resets the anchor to now, so the deposit
// keeps compounding on the full balance ("reinvest into the same jamg'arma").
//
// term_months is optional: when null the deposit is open-ended (earns until
// withdrawn); when set, accrual is capped at the maturity amount.

const DAY_MS = 86_400_000;

// Asia/Tashkent is a fixed UTC+5 offset year-round (matches format.ts/dates.ts).
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

// Whole days elapsed since the accrual anchor. Timezone offsets cancel in the
// subtraction, so a plain floored difference is correct.
export function daysElapsed(startIso: string, now: Date): number {
  const ms = now.getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.floor(ms / DAY_MS));
}

// Whole completed months between the anchor and now, anchored to Tashkent.
export function monthsElapsed(startIso: string, now: Date): number {
  const s = new Date(new Date(startIso).getTime() + TASHKENT_OFFSET_MS);
  const n = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  let m =
    (n.getUTCFullYear() - s.getUTCFullYear()) * 12 +
    (n.getUTCMonth() - s.getUTCMonth());
  if (n.getUTCDate() < s.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

// Whole days from the anchor to its +termMonths calendar anniversary (the point
// at which a fixed-term deposit matures).
export function termEndDays(startIso: string, termMonths: number): number {
  const s = new Date(startIso);
  const e = new Date(s);
  e.setMonth(e.getMonth() + termMonths);
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / DAY_MS));
}

export type JamgarmaState = {
  principal: number; // current capital (grows on each top-up)
  annualRate: number;
  accrued: number; // current balance = principal + interest since the anchor
  earned: number; // accrued - principal (interest since the last anchor/top-up)
  dailyEarn: number; // interest the balance earns per day at the current size
  monthlyEarn: number; // interest over the next ~30 days at the current size
  matured: boolean;
  monthsElapsed: number;
  termMonths: number | null; // null = open-ended
  monthsRemaining: number | null; // null = open-ended
  maturityValue: number | null; // null = open-ended
};

export function computeJamgarma(
  principal: number,
  annualRate: number,
  termMonths: number | null,
  startIso: string,
  now: Date,
): JamgarmaState {
  const dailyRate = annualRate / 100 / 365;
  const elapsedDays = daysElapsed(startIso, now);
  const elapsedMonths = monthsElapsed(startIso, now);
  const hasTerm = termMonths != null && termMonths > 0;

  let effectiveDays = elapsedDays;
  let matured = false;
  if (hasTerm) {
    const td = termEndDays(startIso, termMonths);
    if (elapsedDays >= td) {
      effectiveDays = td;
      matured = true;
    }
  }

  const accrued = principal * Math.pow(1 + dailyRate, effectiveDays);
  const earned = accrued - principal;
  const dailyEarn = matured ? 0 : accrued * dailyRate;
  const monthlyEarn = matured ? 0 : accrued * (Math.pow(1 + dailyRate, 30) - 1);

  return {
    principal,
    annualRate,
    accrued,
    earned,
    dailyEarn,
    monthlyEarn,
    matured,
    monthsElapsed: hasTerm ? Math.min(elapsedMonths, termMonths) : elapsedMonths,
    termMonths: hasTerm ? termMonths : null,
    monthsRemaining: hasTerm ? Math.max(0, termMonths - elapsedMonths) : null,
    maturityValue: hasTerm
      ? principal * Math.pow(1 + dailyRate, termEndDays(startIso, termMonths))
      : null,
  };
}
