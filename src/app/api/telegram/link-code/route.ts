import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Unambiguous charset (no 0/O/1/I) for codes users may read off a screen.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return out;
}

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

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error } = await supabase.from("telegram_codes").insert({
    code,
    user_id: user.id,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("link-code insert error:", error);
    return NextResponse.json({ error: "Kod yaratishda xatolik" }, {
      status: 500,
    });
  }

  return NextResponse.json({ code });
}
