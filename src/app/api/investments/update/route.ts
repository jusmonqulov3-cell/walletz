import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Parses an optional positive UZS price; returns null when absent/invalid.
function optionalPrice(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
    return NextResponse.json({ error: "Investitsiya tanlanmadi" }, {
      status: 400,
    });
  }

  // Build a patch from only the fields that were provided.
  const patch: Record<string, number> = {};
  if (raw.quantity !== undefined) {
    const quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Miqdor musbat son bo'lishi kerak" },
        { status: 400 },
      );
    }
    patch.quantity = quantity;
  }
  if (raw.buy_price !== undefined) {
    const buyPrice = optionalPrice(raw.buy_price);
    if (buyPrice !== null) patch.buy_price = buyPrice;
  }
  if (raw.manual_price !== undefined) {
    const manualPrice = optionalPrice(raw.manual_price);
    if (manualPrice !== null) patch.manual_price = manualPrice;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Yangilash uchun ma'lumot yo'q" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("investments")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Update investment error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
