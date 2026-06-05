import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { toCategory, type Category } from "@/lib/categories";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

const SYSTEM_INSTRUCTION = `You are an expense parser for an Uzbek personal finance app. The user writes one or more expenses in informal Uzbek/Russian shorthand, on one line or several. Split the input into individual expense items.

For each item extract:
- note: short description (item or merchant), capitalized
- amount: integer in so'm (UZS)
- category: exactly one of [Oziq-ovqat, Transport, Uy, Kommunal, Kiyim, Sog'liq, O'yin-kulgi, Boshqa]
- confidence: number 0 to 1

Amount rules:
- 'ming' or 'k' means thousand: '20 ming' or '20k' = 20000
- 'mln' or 'm' means million: '5 mln' = 5000000
- A bare number under 1000 with no unit: multiply by 1000 ('Taksi 20' = 20000)
- A bare number 1000 or larger: use as-is ('Korzinka 250000' = 250000)

Categorize with Uzbek context: taksi / Yandex Go / avtobus / benzin / metro = Transport; Korzinka / Makro / Havas / non / somsa / EVOS / KFC / qahva / choy / restoran = Oziq-ovqat; ijara / kvartira = Uy; svet / gaz / suv / internet / kommunal = Kommunal; kiyim / krossovka / futbolka = Kiyim; dori / shifokor / klinika = Sog'liq; kino / o'yin / konsert = O'yin-kulgi; anything unclear = Boshqa.

Return ONLY valid JSON in exactly this shape, nothing else:
{"expenses": [{"note": "Taksi", "amount": 20000, "category": "Transport", "confidence": 0.95}]}`;

// Force consistent categories for known merchants (case-insensitive substring
// match on the note). Applied in code after the model returns.
const MERCHANT_OVERRIDES: { keywords: string[]; category: Category }[] = [
  {
    keywords: [
      "korzinka",
      "makro",
      "havas",
      "evos",
      "kfc",
      "max way",
      "oqtepa",
      "bellissimo",
    ],
    category: "Oziq-ovqat",
  },
  {
    keywords: ["yandex", "taksi", "uber", "bolt"],
    category: "Transport",
  },
];

function applyMerchantOverride(note: string, category: Category): Category {
  const lower = note.toLowerCase();
  for (const { keywords, category: forced } of MERCHANT_OVERRIDES) {
    if (keywords.some((k) => lower.includes(k))) return forced;
  }
  return category;
}

type ParsedExpense = {
  note: string;
  amount: number;
  category: Category;
  confidence: number;
};

function normalize(item: unknown): ParsedExpense | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  const amount = Math.round(Number(raw.amount));
  if (!note || !Number.isFinite(amount) || amount <= 0) return null;

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.min(1, Math.max(0, confidence));

  const category = applyMerchantOverride(note, toCategory(raw.category));

  return { note, amount, category, confidence };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const text = (body as { text?: unknown })?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Matn kiritilmadi" },
      { status: 400 },
    );
  }

  let result: unknown;
  try {
    result = await generateJSON(SYSTEM_INSTRUCTION, text);
  } catch (err) {
    console.error("Gemini parse error:", err);
    return NextResponse.json(
      { error: "Tahlil qilishda xatolik. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }

  const rawList = (result as { expenses?: unknown })?.expenses;
  const expenses = Array.isArray(rawList)
    ? rawList.map(normalize).filter((e): e is ParsedExpense => e !== null)
    : [];

  return NextResponse.json({ expenses });
}
