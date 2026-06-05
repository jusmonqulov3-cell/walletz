import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  // Strip characters that would break PostgREST's `or` filter syntax, plus
  // ILIKE wildcards so the query matches the literal text the user typed.
  const q = (searchParams.get("q") ?? "").replace(/[%_,()*\\]/g, " ").trim();

  if (!q) {
    return NextResponse.json({ expenses: [], count: 0, total: 0 });
  }

  const pattern = `%${q}%`;

  const { data, error } = await supabase
    .from("expenses")
    .select("id, note, amount, category, spent_at")
    .or(`note.ilike.${pattern},category.ilike.${pattern}`)
    .order("spent_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Qidiruvda xatolik" }, { status: 500 });
  }

  const expenses = data ?? [];
  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return NextResponse.json({ expenses, count: expenses.length, total });
}
