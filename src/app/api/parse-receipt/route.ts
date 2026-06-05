import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSONFromImage } from "@/lib/gemini";
import { toCategory } from "@/lib/categories";

// Allow up to 30s for the Gemini vision round-trip on Vercel.
export const maxDuration = 30;

const SYSTEM_INSTRUCTION = `You read a photo of a shop or restaurant receipt for an Uzbek finance app. Receipts may be in Uzbek or Russian; amounts are in so'm (UZS). Extract:
- merchant: the store/restaurant name if visible, else null
- total: the grand total as an integer so'm if visible, else null
- expenses: an array of line items, each { note: short clean item label capitalized, amount: integer so'm (that line's price), category: one of [Oziq-ovqat, Transport, Uy, Kommunal, Kiyim, Sog'liq, O'yin-kulgi, Boshqa], confidence: 0–1 }
Ignore subtotal/tax/discount/change/cash lines as items. If the image is not a readable receipt, return empty expenses. Return ONLY JSON: {"merchant":"Korzinka","total":54000,"expenses":[{"note":"Non","amount":4000,"category":"Oziq-ovqat","confidence":0.9}]}`;

type ParsedExpense = {
  note: string;
  amount: number;
  category: string;
  confidence: number;
};

function normalizeExpense(item: unknown): ParsedExpense | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  const amount = Math.round(Number(raw.amount));
  if (!note || !Number.isFinite(amount) || amount <= 0) return null;

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.min(1, Math.max(0, confidence));

  return { note, amount, category: toCategory(raw.category), confidence };
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
  const imageBase64 =
    typeof raw.imageBase64 === "string" ? raw.imageBase64 : "";
  const mimeType = typeof raw.mimeType === "string" ? raw.mimeType : "";
  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ error: "Rasm yuborilmadi" }, { status: 400 });
  }

  let result: unknown;
  try {
    result = await generateJSONFromImage(
      SYSTEM_INSTRUCTION,
      imageBase64,
      mimeType,
    );
  } catch (err) {
    console.error("Gemini parse-receipt error:", err);
    return NextResponse.json(
      { error: "Chekni o'qib bo'lmadi, qaytadan urinib ko'ring." },
      { status: 502 },
    );
  }

  const parsed = (result ?? {}) as Record<string, unknown>;
  const merchant =
    typeof parsed.merchant === "string" && parsed.merchant.trim()
      ? parsed.merchant.trim()
      : null;
  const totalNum = Math.round(Number(parsed.total));
  const total = Number.isFinite(totalNum) && totalNum > 0 ? totalNum : null;
  const expenses = Array.isArray(parsed.expenses)
    ? parsed.expenses
        .map(normalizeExpense)
        .filter((e): e is ParsedExpense => e !== null)
    : [];

  return NextResponse.json({ merchant, total, expenses });
}
