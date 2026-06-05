import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const raw = (body ?? {}) as Record<string, unknown>;
  const goalId = typeof raw.goalId === "string" ? raw.goalId : "";
  const amount = Math.round(Number(raw.amount));

  if (!goalId) {
    return NextResponse.json({ error: "Maqsad tanlanmadi" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json(
      { error: "Summa noto'g'ri" },
      { status: 400 },
    );
  }

  // Verify the goal belongs to the user (RLS also enforces this).
  const { data: goal } = await supabase
    .from("goals")
    .select("id, saved_amount")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!goal) {
    return NextResponse.json({ error: "Maqsad topilmadi" }, { status: 404 });
  }

  // Allow withdrawals, but never go below 0.
  const newSaved = Math.max(0, Number(goal.saved_amount) + amount);

  const { error } = await supabase
    .from("goals")
    .update({ saved_amount: newSaved })
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Contribute error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved_amount: newSaved });
}
