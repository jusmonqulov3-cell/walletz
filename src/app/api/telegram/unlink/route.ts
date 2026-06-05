import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
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

  const { error } = await supabase
    .from("telegram_links")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("telegram unlink error:", error);
    return NextResponse.json({ error: "Uzishda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
