import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeAction, normalizeAction } from "@/lib/aiActions";

// Executes ONE action the user confirmed in the chat. Re-validates the action
// and runs it against the user's RLS-scoped client (ownership re-checked).
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

  const action = normalizeAction((body as { action?: unknown })?.action);
  if (!action) {
    return NextResponse.json({ error: "Amal noto'g'ri" }, { status: 400 });
  }

  const result = await executeAction(supabase, user.id, action);
  if (!result.ok) {
    console.error("chat action error:", result.error);
    return NextResponse.json({ error: "Bajarishda xatolik" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
