import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSON } from "@/lib/gemini";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

const SYSTEM_INSTRUCTION = `You are an income parser for an Uzbek personal finance app. The user lists one or more income entries in informal Uzbek shorthand (one line or several). Split into items. For each extract: source (short label, capitalized) and amount (integer in so'm). Amount rules: 'ming' or 'k' = thousand; 'mln' or 'm' = million; a bare number under 1000 with no unit × 1000; a bare number 1000 or larger as-is. Return ONLY valid JSON, nothing else: {"incomes":[{"source":"Oylik","amount":5000000}]}`;

type ParsedIncome = { source: string; amount: number };

function normalize(item: unknown): ParsedIncome | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const source = typeof raw.source === "string" ? raw.source.trim() : "";
  const amount = Math.round(Number(raw.amount));
  if (!source || !Number.isFinite(amount) || amount <= 0) return null;

  return { source, amount };
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

  const text = (body as { text?: unknown })?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Matn kiritilmadi" }, { status: 400 });
  }

  let result: unknown;
  try {
    result = await generateJSON(SYSTEM_INSTRUCTION, text);
  } catch (err) {
    console.error("Gemini parse-income error:", err);
    return NextResponse.json(
      { error: "Tahlil qilishda xatolik. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }

  const rawList = (result as { incomes?: unknown })?.incomes;
  const incomes = Array.isArray(rawList)
    ? rawList.map(normalize).filter((i): i is ParsedIncome => i !== null)
    : [];

  return NextResponse.json({ incomes });
}
