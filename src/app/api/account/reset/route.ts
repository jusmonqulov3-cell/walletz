import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Activity/data tables wiped on a user "restart". Account-level rows (auth user,
// display name, Telegram link) are intentionally kept.
const TABLES = [
  "expenses",
  "incomes",
  "budgets",
  "goals",
  "debts",
  "investments",
  "chat_messages",
] as const;

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

  // Delete only the requester's rows. The explicit user_id filter plus RLS
  // (delete-own policies on every table) make a cross-user wipe impossible.
  for (const table of TABLES) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", user.id);
    if (error) {
      console.error(`Account reset failed on ${table}:`, error);
      return NextResponse.json(
        { error: "Tozalashda xatolik" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
