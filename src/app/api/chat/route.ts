import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText, type ChatMessage } from "@/lib/gemini";
import { getTashkentMonthInfo } from "@/lib/dates";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

type ExpenseRow = { amount: number; category: string | null; note: string | null };
type IncomeRow = { amount: number };

const SYSTEM_PROMPT = `You are 'Pul', a friendly, sharp personal finance assistant inside an Uzbek expense app. Always answer in Uzbek, concise and direct (2–5 sentences unless more detail is requested).

You are given the user's real financial data as JSON below. Rules:
- Only use the numbers provided. Never invent figures. If the data lacks the answer, say so plainly.
- Format every amount with a space thousands separator and ' so'm' (e.g. 1 200 000 so'm).
- When asked why money went fast or where it went, name the biggest categories/merchants and compare to last month (percentage change) when relevant.
- For 'will my budget last' questions, estimate the pace = (this month total ÷ days elapsed) × days in month, compare to budget, and say roughly how many days the remaining budget lasts at the current pace.
- Be encouraging but honest.

USER DATA:
`;

function sumBy<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + (Number(pick(r)) || 0), 0);
}

function perCategory(rows: ExpenseRow[]): Record<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const cat = r.category || "Boshqa";
    map.set(cat, (map.get(cat) ?? 0) + (Number(r.amount) || 0));
  }
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => b[1] - a[1]),
  );
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

export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const rawMessages = (body as { messages?: unknown })?.messages;
  const messages: ChatMessage[] = Array.isArray(rawMessages)
    ? rawMessages
        .map((m) => {
          const role = (m as { role?: unknown })?.role;
          const text = (m as { text?: unknown })?.text;
          if ((role === "user" || role === "model") && typeof text === "string") {
            return { role, text: text.trim() } as ChatMessage;
          }
          return null;
        })
        .filter((m): m is ChatMessage => m !== null && m.text.length > 0)
    : [];

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Xabar yuborilmadi" },
      { status: 400 },
    );
  }

  const info = getTashkentMonthInfo();

  // Gather financial context. RLS scopes every query to the current user.
  const [thisExpRes, lastExpRes, incomeRes, budgetRes] = await Promise.all([
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
  const incomes = (incomeRes.data ?? []) as IncomeRow[];
  const budget =
    budgetRes.data?.monthly_limit != null
      ? Number(budgetRes.data.monthly_limit)
      : null;

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
      topMerchants: topMerchants(thisExp, 10),
      totalIncome,
      budget,
      remaining: budget != null ? budget - thisTotal : null,
    },
    lastMonth: {
      totalSpending: lastTotal,
      perCategory: perCategory(lastExp),
    },
  };

  const systemInstruction = SYSTEM_PROMPT + JSON.stringify(context, null, 2);

  let reply: string;
  try {
    reply = await generateText(systemInstruction, messages);
  } catch (err) {
    console.error("Chat generation error:", err);
    return NextResponse.json(
      { error: "Javob olishda xatolik. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }

  return NextResponse.json({ reply });
}
