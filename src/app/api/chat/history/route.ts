import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LIMIT = 40;

// Returns the recent chat history (oldest-first) so the UI can restore the
// conversation on load.
export async function GET() {
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

  // Take the newest LIMIT, then present oldest-first.
  const { data } = await supabase
    .from("chat_messages")
    .select("role, content")
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  const messages = (data ?? [])
    .reverse()
    .map((m) => ({ role: m.role, text: m.content }));

  return NextResponse.json({ messages });
}

// Clears the user's chat history.
export async function DELETE() {
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

  await supabase.from("chat_messages").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
