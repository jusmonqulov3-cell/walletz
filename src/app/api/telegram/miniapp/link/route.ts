import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateInitData } from "@/lib/telegram/validateInitData";

// Called right after a first-time manual login inside the Mini App: binds the
// now-authenticated user to their Telegram account so future opens are seamless.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { initData?: string };
  try {
    body = (await request.json()) as { initData?: string };
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const tgUser = validateInitData(body.initData ?? "");
  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("telegram_links").upsert(
    {
      telegram_id: tgUser.id,
      user_id: user.id,
      telegram_username: tgUser.username ?? null,
    },
    { onConflict: "telegram_id" },
  );
  if (error) {
    console.error("miniapp link upsert error:", error);
    return NextResponse.json({ error: "Link failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
