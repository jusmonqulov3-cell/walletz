import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

// Long ban window used for an "indefinite" ban (~100 years).
const BAN_DURATION = "876000h";

export async function POST(request: Request) {
  // Independent authorization — this route NEVER relies on the proxy gate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const userId = typeof raw.userId === "string" ? raw.userId : "";
  const ban = raw.ban === true;

  if (!userId) {
    return NextResponse.json(
      { error: "Foydalanuvchi tanlanmadi" },
      { status: 400 },
    );
  }
  if (ban && userId === user!.id) {
    return NextResponse.json(
      { error: "O'zingizni bloklay olmaysiz" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: ban ? BAN_DURATION : "none",
  });

  if (error) {
    console.error("Admin ban error:", error);
    return NextResponse.json({ error: "Amal bajarilmadi" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, banned: ban });
}
