import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSONChat, type ChatMessage } from "@/lib/gemini";
import { getTashkentMonthInfo } from "@/lib/dates";
import { aiLanguageInstruction } from "@/lib/i18n/aiLanguage";
import { CATEGORY_LIST, normalizeActions } from "@/lib/aiActions";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

type ExpenseRow = { amount: number; category: string | null; note: string | null };
type IncomeRow = { amount: number };

const SYSTEM_PROMPT = `You are 'Pul', a friendly, sharp personal finance assistant inside an Uzbek expense app. Answer concisely and directly (2–5 sentences unless more detail is requested), in the language specified at the top.

You are given the user's real financial data as JSON below. Rules:
- Only use the numbers provided. Never invent figures. If the data lacks the answer, say so plainly.
- Format every amount with a space thousands separator and the currency suffix given in the language instruction.
- When asked why money went fast or where it went, name the biggest categories/merchants and compare to last month (percentage change) when relevant.
- For 'will my budget last' questions, estimate the pace = (this month total ÷ days elapsed) × days in month, compare to budget, and say roughly how many days the remaining budget lasts at the current pace.
- Be encouraging but honest.

ACTIONS: When the user asks to RECORD or CHANGE something, propose actions. NEVER say an action is done — it only runs after the user taps confirm. Each action needs a "summary": a one-line, user-language description of exactly what will happen, with the formatted amount.
Action shapes (include only the fields shown):
- {"type":"add_expense","note":"<short label>","amount":<int so'm>,"category":"<one of: ${CATEGORY_LIST}>","summary":"..."}
- {"type":"add_income","source":"<label>","amount":<int>,"summary":"..."}
- {"type":"add_debt","person":"<name>","amount":<int>,"direction":"lent"|"borrowed","summary":"..."}
- {"type":"set_budget","amount":<int monthly so'm>,"summary":"..."}
- {"type":"create_goal","title":"<name>","target_amount":<int>,"target_date":"YYYY-MM-DD"|null,"summary":"..."}
- {"type":"contribute_goal","goal_id":"<id from goals list>","amount":<int>,"summary":"..."}
- {"type":"settle_debt","debt_id":"<id from openDebts list>","summary":"..."}
Action rules:
- Only propose actions the user clearly requested. For pure questions, use an empty actions array.
- Amount words: 'ming'/'k' = thousand, 'mln'/'m' = million; a bare number under 1000 means ×1000.
- 'lent' = user gave money out (qarz berdim); 'borrowed' = user took money (qarz oldim).
- For contribute_goal and settle_debt you MUST use an id from the provided lists. If nothing matches, don't invent one — ask in "reply" which one.
- 'reply' is always a short message in the user's language (e.g. confirm what you understood, or answer the question).

OUTPUT: Return ONLY JSON of this exact shape: {"reply":"<text>","actions":[<zero or more action objects>]}

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
  const [thisExpRes, lastExpRes, incomeRes, budgetRes, goalsRes, debtsRes] =
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
      supabase
        .from("goals")
        .select("id, title, target_amount, saved_amount, target_date"),
      supabase
        .from("debts")
        .select("id, person, amount, direction")
        .eq("settled", false),
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
    // Provided so the assistant can reference goals/debts by id for actions.
    goals: (goalsRes.data ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      target_amount: Number(g.target_amount),
      saved_amount: Number(g.saved_amount),
      target_date: g.target_date ?? null,
    })),
    openDebts: (debtsRes.data ?? []).map((d) => ({
      id: d.id,
      person: d.person,
      amount: Number(d.amount),
      direction: d.direction,
    })),
  };

  const systemInstruction =
    (await aiLanguageInstruction()) +
    "\n\n" +
    SYSTEM_PROMPT +
    JSON.stringify(context, null, 2);

  let result: unknown;
  try {
    // Cap the history we send to the model to keep tokens/latency bounded.
    result = await generateJSONChat(systemInstruction, messages.slice(-20));
  } catch (err) {
    console.error("Chat generation error:", err);
    return NextResponse.json(
      { error: "Javob olishda xatolik. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }

  const r = (result ?? {}) as { reply?: unknown; actions?: unknown };
  const reply = typeof r.reply === "string" ? r.reply : "";
  const actions = normalizeActions(r.actions);

  // Persist this turn so the conversation survives reloads. Text only — past
  // action cards are not re-rendered (avoids accidental re-execution).
  const lastUser = messages[messages.length - 1];
  const rows = [
    { user_id: user.id, role: "user", content: lastUser.text },
    ...(reply ? [{ user_id: user.id, role: "model", content: reply }] : []),
  ];
  const { error: histErr } = await supabase.from("chat_messages").insert(rows);
  if (histErr) console.error("chat history insert error:", histErr);

  return NextResponse.json({ reply, actions });
}
