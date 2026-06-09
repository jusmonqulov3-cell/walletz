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
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) {
    return NextResponse.json({ error: "Daromad tanlanmadi" }, { status: 400 });
  }

  // Build a patch from only the fields that were provided.
  const patch: Record<string, string | number> = {};
  if (raw.amount !== undefined) {
    const amount = Math.round(Number(raw.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Summa musbat son bo'lishi kerak" },
        { status: 400 },
      );
    }
    patch.amount = amount;
  }
  if (raw.source !== undefined) {
    const source = typeof raw.source === "string" ? raw.source.trim() : "";
    if (!source) {
      return NextResponse.json({ error: "Manba kerak" }, { status: 400 });
    }
    patch.source = source;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Yangilash uchun ma'lumot yo'q" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("incomes")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Update income error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
