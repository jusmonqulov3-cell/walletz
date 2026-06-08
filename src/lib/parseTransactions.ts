import "server-only";
import { toCategory, type Category } from "@/lib/categories";

// System instruction for Gemini: classify a free-form financial statement
// (spoken or written, Uzbek/Russian) into expenses, incomes, and debts. Used by
// the Telegram webhook for both voice notes and text messages.
export const TRANSACTION_INSTRUCTION = `You parse a financial statement from an Uzbek personal finance app (it may be transcribed speech or text, in Uzbek or Russian). It can contain MULTIPLE items of different kinds in one message. Classify each into expenses, incomes, or debts.
- expense: money spent on goods/services (ishlatdim, to'ladim, sotib oldim, xarid, ketdi). Fields: note (short label, capitalized), amount (integer so'm), category (one of [Oziq-ovqat, Transport, Uy, Kommunal, Kiyim, Sog'liq, O'yin-kulgi, Boshqa]).
- income: money received as earnings (oylik, maosh, daromad, ishlab topdim, freelance). Fields: source (capitalized), amount.
- debt: lending/borrowing with a person. 'qarz berdim' / '<ism>ga berdim' = direction 'lent'; 'qarz oldim' / '<ism>dan oldim' = direction 'borrowed'. Fields: person (capitalized), amount, direction.
Amount rules: 'ming'/'k' = thousand, 'mln'/'m' = million; spoken numbers ('yigirma ming'=20000, 'o'n ming'=10000); a bare number under 1000 ×1000.
If audio, also include what you heard as 'transcript'.
Return ONLY JSON: {"transcript":"...","expenses":[{"note":"Taksi","amount":10000,"category":"Transport"}],"incomes":[],"debts":[{"person":"Bobur","amount":20000,"direction":"lent"}]}`;

export type ParsedExpense = { note: string; amount: number; category: Category };
export type ParsedIncome = { source: string; amount: number };
export type ParsedDebt = {
  person: string;
  amount: number;
  direction: "borrowed" | "lent";
};

export type ParsedTransactions = {
  transcript: string | null;
  expenses: ParsedExpense[];
  incomes: ParsedIncome[];
  debts: ParsedDebt[];
};

// A positive integer so'm amount, or null when missing/invalid.
function toAmount(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asRecord(item: unknown): Record<string, unknown> | null {
  return item && typeof item === "object"
    ? (item as Record<string, unknown>)
    : null;
}

function normalizeExpense(item: unknown): ParsedExpense | null {
  const raw = asRecord(item);
  if (!raw) return null;
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  const amount = toAmount(raw.amount);
  if (!note || amount === null) return null;
  return { note, amount, category: toCategory(raw.category) };
}

function normalizeIncome(item: unknown): ParsedIncome | null {
  const raw = asRecord(item);
  if (!raw) return null;
  const source = typeof raw.source === "string" ? raw.source.trim() : "";
  const amount = toAmount(raw.amount);
  if (!source || amount === null) return null;
  return { source, amount };
}

function normalizeDebt(item: unknown): ParsedDebt | null {
  const raw = asRecord(item);
  if (!raw) return null;
  const person = typeof raw.person === "string" ? raw.person.trim() : "";
  const amount = toAmount(raw.amount);
  // Direction must be explicit — lent and borrowed are opposites, so we drop
  // anything ambiguous rather than guess.
  if (raw.direction !== "lent" && raw.direction !== "borrowed") return null;
  if (!person || amount === null) return null;
  return { person, amount, direction: raw.direction };
}

function normalizeList<T>(
  value: unknown,
  fn: (item: unknown) => T | null,
): T[] {
  return Array.isArray(value)
    ? value.map(fn).filter((x): x is T => x !== null)
    : [];
}

/**
 * Defensively normalizes Gemini's (or a stored payload's) raw output into a
 * clean ParsedTransactions: drops items with non-positive amounts or empty
 * labels, coerces unknown categories to "Boshqa", and requires a valid debt
 * direction.
 */
export function normalizeTransactions(result: unknown): ParsedTransactions {
  const raw = asRecord(result) ?? {};
  const transcript =
    typeof raw.transcript === "string" && raw.transcript.trim()
      ? raw.transcript.trim()
      : null;
  return {
    transcript,
    expenses: normalizeList(raw.expenses, normalizeExpense),
    incomes: normalizeList(raw.incomes, normalizeIncome),
    debts: normalizeList(raw.debts, normalizeDebt),
  };
}
