import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeJamgarma } from "@/lib/jamgarma";

// Top up (reinvest into) a jamg'arma: capitalize the interest earned so far
// into the principal, add the new money, and reset the accrual anchor
// (created_at) to now — so the deposit keeps compounding on the full balance.
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
  const id = typeof raw.id === "string" ? raw.id : "";
  const amount = Math.round(Number(raw.amount));

  if (!id) {
    return NextResponse.json(
      { error: "Investitsiya tanlanmadi" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Summa musbat son bo'lishi kerak" },
      { status: 400 },
    );
  }

  const { data: row, error: fetchErr } = await supabase
    .from("investments")
    .select("id, type, quantity, interest_rate, term_months, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  if (row.type !== "jamgarma") {
    return NextResponse.json(
      { error: "Faqat jamg'arma to'ldiriladi" },
      { status: 400 },
    );
  }

  const principal = Number(row.quantity);
  const annualRate = row.interest_rate != null ? Number(row.interest_rate) : 0;
  const termMonths = row.term_months != null ? Number(row.term_months) : null;
  const { accrued } = computeJamgarma(
    principal,
    annualRate,
    termMonths,
    row.created_at,
    new Date(),
  );

  const newQuantity = Math.round(accrued + amount);

  const { error } = await supabase
    .from("investments")
    .update({ quantity: newQuantity, created_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Top-up investment error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quantity: newQuantity });
}
