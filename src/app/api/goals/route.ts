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
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const targetAmount = Math.round(Number(raw.target_amount));
  const targetDate =
    typeof raw.target_date === "string" && raw.target_date.trim()
      ? raw.target_date.trim()
      : null;

  if (!title) {
    return NextResponse.json({ error: "Maqsad nomi kerak" }, { status: 400 });
  }
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return NextResponse.json(
      { error: "Maqsad summasi musbat son bo'lishi kerak" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title,
      target_amount: targetAmount,
      saved_amount: 0,
      target_date: targetDate,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Create goal error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
