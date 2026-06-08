import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateInitData } from "@/lib/telegram/validateInitData";

// Mini App sign-in. The client posts Telegram's signed initData; if the
// Telegram account is linked to a PulNazorat user, we mint a Supabase cookie
// session for them. Otherwise we report linked:false so the client shows login.
export async function POST(request: Request) {
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
  const { data: link } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  if (!link) return NextResponse.json({ linked: false });

  // Resolve the linked auth user's email.
  const { data: authData, error: getErr } =
    await admin.auth.admin.getUserById(link.user_id);
  const email = authData?.user?.email;
  if (getErr || !email) {
    console.error("miniapp getUserById error:", getErr);
    // Link points at a missing user — treat as unlinked so they can re-auth.
    return NextResponse.json({ linked: false });
  }

  // Mint a one-time magic-link token and verify it on the cookie-bound client so
  // the standard Supabase session cookies are set on the response. The verify
  // OTP type depends on project config, so try the valid types with a fresh
  // single-use token each.
  const supabase = await createClient();
  for (const type of ["magiclink", "email"] as const) {
    const { data: gen, error: genErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = gen?.properties?.hashed_token;
    if (genErr || !tokenHash) {
      console.error("miniapp generateLink error:", genErr);
      continue;
    }
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!verifyErr) return NextResponse.json({ linked: true });
    console.error(`miniapp verifyOtp(${type}) error:`, verifyErr);
  }

  return NextResponse.json({ error: "Auth failed" }, { status: 500 });
}
