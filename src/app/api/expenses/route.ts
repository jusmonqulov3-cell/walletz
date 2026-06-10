import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCategory } from "@/lib/categories";
import { isoForYmd } from "@/lib/dates";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Avtorizatsiya talab qilinadi" }, {
      status: 401,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const list = (body as { expenses?: unknown })?.expenses;
  if (!Array.isArray(list) || list.length === 0) {
    return NextResponse.json(
      { error: "Saqlash uchun xarajat yo'q" },
      { status: 400 },
    );
  }

  const rows = list
    .map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const note = typeof raw.note === "string" ? raw.note.trim() : "";
      const amount = Math.round(Number(raw.amount));
      if (!Number.isFinite(amount) || amount <= 0) return null;
      // Optional backdating: client sends the chosen day as YYYY-MM-DD. An
      // invalid or future value resolves to null and the column defaults to now().
      const spentAt = isoForYmd(raw.date);
      return {
        user_id: user.id,
        raw_text: note,
        note,
        amount,
        category: toCategory(raw.category),
        currency: "UZS",
        ...(spentAt ? { spent_at: spentAt } : {}),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Yaroqli xarajat topilmadi" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("expenses").insert(rows);

  if (error) {
    console.error("Insert expenses error:", error);
    return NextResponse.json(
      { error: "Saqlashda xatolik" },
      { status: 500 },
    );
  }

  return NextResponse.json({ inserted: rows.length });
}
