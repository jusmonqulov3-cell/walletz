import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";

const SYSTEM_INSTRUCTION = `You parse debt statements from an Uzbek personal finance app. The user says they borrowed or lent money. Extract: person (the other person's name, capitalized), amount (integer so'm — same rules: 'ming'/'k'=thousand, 'mln'/'m'=million, bare number under 1000 ×1000, 1000+ as-is), and direction: 'borrowed' if the user took/received money (oldim, qarz oldim), 'lent' if the user gave money (berdim, qarz berdim). Return ONLY JSON: {"person":"Aziz","amount":500000,"direction":"borrowed"}`;

type ParsedDebt = {
  person: string;
  amount: number;
  direction: "borrowed" | "lent";
};

function normalize(item: unknown): ParsedDebt | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const person = typeof raw.person === "string" ? raw.person.trim() : "";
  const amount = Math.round(Number(raw.amount));
  const direction = raw.direction === "lent" ? "lent" : "borrowed";
  if (!person || !Number.isFinite(amount) || amount <= 0) return null;

  return { person, amount, direction };
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
    return NextResponse.json({ error: "Matn kiritilmadi" }, { status: 400 });
  }

  let result: unknown;
  try {
    result = await generateJSON(SYSTEM_INSTRUCTION, text);
  } catch (err) {
    console.error("Gemini parse-debt error:", err);
    return NextResponse.json(
      { error: "Tahlil qilishda xatolik. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }

  const debt = normalize(result);
  if (!debt) {
    return NextResponse.json(
      { error: "Hech qanday qarz aniqlanmadi." },
      { status: 422 },
    );
  }

  return NextResponse.json({ debt });
}
