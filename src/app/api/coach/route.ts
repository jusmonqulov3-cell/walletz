import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSON } from "@/lib/gemini";
import { getTashkentMonthInfo, getTashkentPeriods } from "@/lib/dates";
import { aiLanguageInstruction } from "@/lib/i18n/aiLanguage";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are 'Pul', a proactive personal finance coach in an Uzbek app. Using ONLY the numbers provided, give 2–4 short, specific, actionable insights about the user's spending habits, in the language specified at the top. Each insight should be one or two sentences. Prefer concrete observations with numbers and a suggested action and its monthly saving (e.g. 'In the last 14 days snacks cost 280 000 so'm. Cutting 20% saves ~240 000 so'm/month.'). Compare to last month where useful (percentage changes). Be encouraging, never preachy. Format amounts as specified in the language instruction. Never invent numbers. Return the insights as a JSON array of strings: {"insights":["...","..."]}

DATA:
`;

type ExpenseRow = { amount: number; category: string | null; note: string | null };
type IncomeRow = { amount: number };

function sumBy<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + (Number(pick(r)) || 0), 0);
}

function perCategory(rows: ExpenseRow[]): Record<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const cat = r.category || "Boshqa";
    map.set(cat, (map.get(cat) ?? 0) + (Number(r.amount) || 0));
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]));
}

function topMerchants(rows: ExpenseRow[], n: number) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const note = (r.note || "Boshqa").trim();
    map.set(note, (map.get(note) ?? 0) + (Number(r.amount) || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([note, total]) => ({ note, total }));
}

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Avtorizatsiya talab qilinadi" },
      { status: 401 },
    );
  }

  const info = getTashkentMonthInfo();
  const { startOfToday } = getTashkentPeriods();
  // 14-day window inclusive of today (today's Tashkent midnight minus 13 days).
  const start14 = new Date(
    new Date(startOfToday).getTime() - 13 * DAY_MS,
  ).toISOString();

  // Gather financial context. RLS scopes every query to the current user.
  const [thisExpRes, lastExpRes, last14Res, incomeRes, budgetRes] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("amount, category, note")
        .gte("spent_at", info.startOfMonth),
      supabase
        .from("expenses")
        .select("amount, category, note")
        .gte("spent_at", info.startOfLastMonth)
        .lt("spent_at", info.endOfLastMonth),
      supabase
        .from("expenses")
        .select("amount, category, note")
        .gte("spent_at", start14),
      supabase
        .from("incomes")
        .select("amount")
        .gte("received_at", info.startOfMonth),
      supabase
        .from("budgets")
        .select("monthly_limit")
        .is("category", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const thisExp = (thisExpRes.data ?? []) as ExpenseRow[];
  const lastExp = (lastExpRes.data ?? []) as ExpenseRow[];
  const last14 = (last14Res.data ?? []) as ExpenseRow[];
  const incomes = (incomeRes.data ?? []) as IncomeRow[];
  const budget =
    budgetRes.data?.monthly_limit != null
      ? Number(budgetRes.data.monthly_limit)
      : null;

  // Not enough data to coach on — let the UI show its empty-state message
  // without burning a Gemini call.
  if (thisExp.length === 0 && lastExp.length === 0) {
    return NextResponse.json({ insights: [] });
  }

  const thisTotal = sumBy(thisExp, (r) => r.amount);
  const lastTotal = sumBy(lastExp, (r) => r.amount);
  const totalIncome = sumBy(incomes, (r) => r.amount);

  const context = {
    currency: "UZS",
    dateInfo: {
      today: info.today,
      dayOfMonth: info.dayOfMonth,
      daysInMonth: info.daysInMonth,
      daysRemaining: info.daysRemaining,
    },
    thisMonth: {
      totalSpending: thisTotal,
      perCategory: perCategory(thisExp),
      totalIncome,
      budget,
      remaining: budget != null ? budget - thisTotal : null,
    },
    lastMonth: {
      totalSpending: lastTotal,
      perCategory: perCategory(lastExp),
    },
    last14Days: {
      perCategory: perCategory(last14),
      topMerchants: topMerchants(last14, 10),
    },
  };

  const systemInstruction =
    (await aiLanguageInstruction()) +
    "\n\n" +
    SYSTEM_PROMPT +
    JSON.stringify(context, null, 2);

  let result: unknown;
  try {
    result = await generateJSON(
      systemInstruction,
      "Mening xarajatlarim bo'yicha maslahat bering.",
    );
  } catch (err) {
    console.error("Coach generation error:", err);
    return NextResponse.json(
      { error: "Tahlil qilishda xatolik. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }

  const rawList = (result as { insights?: unknown })?.insights;
  const insights = Array.isArray(rawList)
    ? rawList
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0)
    : [];

  return NextResponse.json({ insights });
}
