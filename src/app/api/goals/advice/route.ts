import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/gemini";
import { getTashkentMonthInfo } from "@/lib/dates";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are 'Pul', a friendly finance coach in an Uzbek app. The user has a savings goal. Using ONLY the numbers provided, advise in Uzbek in 2–4 sentences: how much to save per month to reach the goal (if a target_date is given, base it on the months remaining; otherwise suggest a realistic monthly amount from their surplus and state the resulting timeline). Say whether it's realistic given their surplus — if surplus is low or negative, gently say so and suggest a smaller monthly amount or longer timeline. Format every amount with a space thousands separator and ' so'm'. Never invent numbers.

DATA:
`;

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

  const goalId = (body as { goalId?: unknown })?.goalId;
  if (typeof goalId !== "string" || !goalId) {
    return NextResponse.json({ error: "Maqsad tanlanmadi" }, { status: 400 });
  }

  const { data: goal } = await supabase
    .from("goals")
    .select("title, target_amount, saved_amount, target_date")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!goal) {
    return NextResponse.json({ error: "Maqsad topilmadi" }, { status: 404 });
  }

  const info = getTashkentMonthInfo();

  const [incomeRes, expenseRes] = await Promise.all([
    supabase.from("incomes").select("amount").gte("received_at", info.startOfMonth),
    supabase.from("expenses").select("amount").gte("spent_at", info.startOfMonth),
  ]);

  const sum = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  const thisMonthIncome = sum(incomeRes.data as { amount: number }[] | null);
  const thisMonthSpending = sum(expenseRes.data as { amount: number }[] | null);
  const surplus = thisMonthIncome - thisMonthSpending;

  const target = Number(goal.target_amount);
  const saved = Number(goal.saved_amount);

  const context = {
    currency: "UZS",
    today: info.today,
    goal: {
      title: goal.title,
      target_amount: target,
      saved_amount: saved,
      remaining: target - saved,
      target_date: goal.target_date ?? null,
    },
    thisMonthIncome,
    thisMonthSpending,
    surplus,
  };

  const systemInstruction = SYSTEM_PROMPT + JSON.stringify(context, null, 2);

  let advice: string;
  try {
    advice = await generateText(systemInstruction, [
      { role: "user", text: "Maqsadim uchun maslahat bering." },
    ]);
  } catch (err) {
    console.error("Goal advice error:", err);
    return NextResponse.json(
      { error: "Maslahat olishda xatolik. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }

  return NextResponse.json({ advice });
}
