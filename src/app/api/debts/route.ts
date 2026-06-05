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
  const person = typeof raw.person === "string" ? raw.person.trim() : "";
  const amount = Math.round(Number(raw.amount));
  const direction = raw.direction === "lent" ? "lent" : "borrowed";
  const note =
    typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;

  if (!person) {
    return NextResponse.json({ error: "Ism kerak" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Summa musbat son bo'lishi kerak" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("debts")
    .insert({
      user_id: user.id,
      person,
      amount,
      direction,
      note,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Create debt error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
