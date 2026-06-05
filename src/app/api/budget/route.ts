import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTashkentPeriods } from "@/lib/dates";

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

  const limit = Math.round(Number((body as { monthly_limit?: unknown })?.monthly_limit));
  if (!Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json(
      { error: "Budjet musbat son bo'lishi kerak" },
      { status: 400 },
    );
  }

  const { periodStart } = getTashkentPeriods();

  // One overall budget per user (category IS NULL). Update if it exists,
  // otherwise insert — there's no unique constraint to rely on upsert.
  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", user.id)
    .is("category", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("budgets")
      .update({ monthly_limit: limit, period_start: periodStart })
      .eq("id", existing.id);
    if (error) {
      console.error("Budget update error:", error);
      return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("budgets").insert({
      user_id: user.id,
      category: null,
      monthly_limit: limit,
      period_start: periodStart,
    });
    if (error) {
      console.error("Budget insert error:", error);
      return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, monthly_limit: limit });
}
