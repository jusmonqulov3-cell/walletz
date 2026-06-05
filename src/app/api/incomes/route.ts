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

  const list = (body as { incomes?: unknown })?.incomes;
  if (!Array.isArray(list) || list.length === 0) {
    return NextResponse.json(
      { error: "Saqlash uchun daromad yo'q" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const rows = list
    .map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const source = typeof raw.source === "string" ? raw.source.trim() : "";
      const amount = Math.round(Number(raw.amount));
      if (!source || !Number.isFinite(amount) || amount <= 0) return null;
      return {
        user_id: user.id,
        amount,
        source,
        received_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Yaroqli daromad topilmadi" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("incomes").insert(rows);

  if (error) {
    console.error("Insert incomes error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ inserted: rows.length });
}
