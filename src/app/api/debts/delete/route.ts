import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const debtId = (body as { debtId?: unknown })?.debtId;
  if (typeof debtId !== "string" || !debtId) {
    return NextResponse.json({ error: "Qarz tanlanmadi" }, { status: 400 });
  }

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", debtId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Delete debt error:", error);
    return NextResponse.json({ error: "O'chirishda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
