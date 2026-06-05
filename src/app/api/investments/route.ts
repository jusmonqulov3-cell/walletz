import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["valyuta", "kripto", "aksiya", "jamgarma"] as const;
type InvestmentType = (typeof TYPES)[number];

function isType(value: unknown): value is InvestmentType {
  return (TYPES as readonly string[]).includes(value as string);
}

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
  const type = raw.type;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const symbol =
    typeof raw.symbol === "string" && raw.symbol.trim()
      ? raw.symbol.trim()
      : null;
  const quantity = Number(raw.quantity);
  const buyPrice = optionalPrice(raw.buy_price);
  const manualPrice = optionalPrice(raw.manual_price);

  if (!isType(type)) {
    return NextResponse.json({ error: "Noto'g'ri tur" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Nom kerak" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json(
      { error: "Miqdor musbat son bo'lishi kerak" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("investments")
    .insert({
      user_id: user.id,
      type,
      name,
      symbol,
      quantity,
      buy_price: buyPrice,
      manual_price: manualPrice,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Create investment error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
