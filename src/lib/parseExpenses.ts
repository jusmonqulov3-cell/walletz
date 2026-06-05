import "server-only";
import { generateJSON } from "@/lib/gemini";
import { toCategory, type Category } from "@/lib/categories";

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

export function applyMerchantOverride(
  note: string,
  category: Category,
): Category {
  const lower = note.toLowerCase();
  for (const { keywords, category: forced } of MERCHANT_OVERRIDES) {
    if (keywords.some((k) => lower.includes(k))) return forced;
  }
  return category;
}

export type ParsedExpense = {
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

/**
 * Parses free-form Uzbek/Russian expense text into structured items via Gemini,
 * applying merchant overrides and defensive normalization.
 *
 * Used by both the /api/parse route and the Telegram webhook.
 *
 * @throws If the Gemini call fails (callers should handle and report).
 */
export async function parseExpenses(text: string): Promise<ParsedExpense[]> {
  const result = await generateJSON(SYSTEM_INSTRUCTION, text);
  const rawList = (result as { expenses?: unknown })?.expenses;
  return Array.isArray(rawList)
    ? rawList.map(normalize).filter((e): e is ParsedExpense => e !== null)
    : [];
}
