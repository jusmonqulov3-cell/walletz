import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJSONFromAudio } from "@/lib/gemini";
import { toCategory } from "@/lib/categories";
import { applyMerchantOverride, normalizeDaysAgo } from "@/lib/parseExpenses";
import { todayYmd } from "@/lib/dates";

// Allow up to 30s for the Gemini audio round-trip on Vercel.
export const maxDuration = 30;

const SYSTEM_INSTRUCTION = `You receive an audio recording where the user describes one or more expenses in spoken Uzbek or Russian (e.g. 'bugun taksiga yigirma ming, somsaga o'n sakkiz ming ishlatdim'). First transcribe what they said, then extract the expense items. For each item: note (short label, capitalized), amount (integer in so'm — convert spoken numbers: 'yigirma ming' = 20000, 'o'n sakkiz ming' = 18000, 'besh million' = 5000000; a bare small number means thousands), category (one of [Oziq-ovqat, Transport, Uy, Kommunal, Kiyim, Sog'liq, O'yin-kulgi, Boshqa]), daysAgo (integer: whole days before today the expense happened — 0 = today/unspecified, 1 = 'kecha' yesterday, 2 = day before; resolve relative words and explicit dates against TODAY'S DATE below; never negative or future), confidence 0–1. Return ONLY JSON: {"transcript":"...","expenses":[{"note":"Taksi","amount":20000,"category":"Transport","daysAgo":0,"confidence":0.9}]}`;

type ParsedExpense = {
  note: string;
  amount: number;
  category: string;
  daysAgo: number;
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

  const category = applyMerchantOverride(note, toCategory(raw.category));

  return {
    note,
    amount,
    category,
    daysAgo: normalizeDaysAgo(raw.daysAgo),
    confidence,
  };
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
  const audioBase64 =
    typeof raw.audioBase64 === "string" ? raw.audioBase64 : "";
  const mimeType = typeof raw.mimeType === "string" ? raw.mimeType : "";
  if (!audioBase64 || !mimeType) {
    return NextResponse.json({ error: "Ovoz yuborilmadi" }, { status: 400 });
  }

  let result: unknown;
  try {
    result = await generateJSONFromAudio(
      `${SYSTEM_INSTRUCTION}\n\nTODAY'S DATE: ${todayYmd()} (Asia/Tashkent).`,
      audioBase64,
      mimeType,
    );
  } catch (err) {
    console.error("Gemini parse-voice error:", err);
    return NextResponse.json(
      { error: "Tushunmadim, qaytadan urinib ko'ring." },
      { status: 502 },
    );
  }

  const parsed = (result ?? {}) as Record<string, unknown>;
  const transcript =
    typeof parsed.transcript === "string" ? parsed.transcript.trim() : "";
  const expenses = Array.isArray(parsed.expenses)
    ? parsed.expenses
        .map(normalizeExpense)
        .filter((e): e is ParsedExpense => e !== null)
    : [];

  return NextResponse.json({ transcript, expenses });
}
