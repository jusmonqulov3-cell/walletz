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

// Annual interest rate in % (jamgarma). Allows decimals; null when absent/invalid.
function optionalRate(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Deposit term in whole months (jamgarma); null when absent/invalid.
function optionalTerm(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// jamgarma opening date — the accrual anchor. Accepts "YYYY-MM-DD" (read as
// Tashkent midnight) or a full ISO string. Must not be in the future. Returns
// an ISO timestamp, or null when absent/invalid.
function optionalOpenedAt(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00+05:00` : value);
  if (Number.isNaN(d.getTime())) return null;
  // Allow a day of slack so a "today" pick can't be rejected by tz skew.
  if (d.getTime() > Date.now() + 86_400_000) return null;
  return d.toISOString();
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
  const interestRate = optionalRate(raw.interest_rate);
  const termMonths = optionalTerm(raw.term_months);
  const openedAt = optionalOpenedAt(raw.opened_at);

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

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    type,
    name,
    symbol,
    quantity,
    buy_price: buyPrice,
    manual_price: manualPrice,
    interest_rate: interestRate,
    term_months: termMonths,
  };
  // For a jamgarma, created_at doubles as the accrual anchor, so a user-set
  // opening date backdates accrual (e.g. a deposit opened years ago).
  if (type === "jamgarma" && openedAt) insertRow.created_at = openedAt;

  const { data, error } = await supabase
    .from("investments")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    console.error("Create investment error:", error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
