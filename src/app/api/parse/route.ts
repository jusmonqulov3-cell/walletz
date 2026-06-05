import { NextResponse } from "next/server";
import { parseExpenses } from "@/lib/parseExpenses";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

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

  try {
    const expenses = await parseExpenses(text);
    return NextResponse.json({ expenses });
  } catch (err) {
    console.error("Gemini parse error:", err);
    return NextResponse.json(
      { error: "Tahlil qilishda xatolik. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }
}
