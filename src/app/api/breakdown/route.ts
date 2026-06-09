import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Category } from "@/lib/categories";

// Asia/Tashkent is a fixed UTC+5 offset year-round (matches lib/dates.ts).
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Converts inclusive Tashkent calendar dates (YYYY-MM-DD) into a half-open UTC
// instant range [lower, upper) suitable for comparing against stored timestamps.
function tashkentRange(from: string, to: string) {
  const lower = new Date(`${from}T00:00:00.000+05:00`);
  const toStart = new Date(`${to}T00:00:00.000+05:00`);
  const upper = new Date(toStart.getTime() + DAY_MS); // exclusive end
  return { lowerIso: lower.toISOString(), upperIso: upper.toISOString() };
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const type = searchParams.get("type") === "income" ? "income" : "expense";

  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: "Sana noto'g'ri" }, { status: 400 });
  }

  const { lowerIso, upperIso } = tashkentRange(from, to);
  const byLabel = new Map<string, number>();

  if (type === "income") {
    const { data, error } = await supabase
      .from("incomes")
      .select("amount, source")
      .gte("received_at", lowerIso)
      .lt("received_at", upperIso);

    if (error) {
      console.error("Breakdown income error:", error);
      return NextResponse.json({ error: "Xatolik" }, { status: 500 });
    }

    for (const row of data ?? []) {
      const label =
        typeof row.source === "string" && row.source.trim()
          ? row.source.trim()
          : "Boshqa";
      byLabel.set(label, (byLabel.get(label) ?? 0) + (Number(row.amount) || 0));
    }
  } else {
    const { data, error } = await supabase
      .from("expenses")
      .select("amount, category")
      .gte("spent_at", lowerIso)
      .lt("spent_at", upperIso);

    if (error) {
      console.error("Breakdown expense error:", error);
      return NextResponse.json({ error: "Xatolik" }, { status: 500 });
    }

    for (const row of data ?? []) {
      const label: Category = (CATEGORIES as readonly string[]).includes(
        row.category ?? "",
      )
        ? (row.category as Category)
        : "Boshqa";
      byLabel.set(label, (byLabel.get(label) ?? 0) + (Number(row.amount) || 0));
    }
  }

  const total = [...byLabel.values()].reduce((s, v) => s + v, 0);
  const segments = [...byLabel.entries()]
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({
      label,
      total: value,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ type, total, segments });
}
