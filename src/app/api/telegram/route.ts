import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram";
import { parseExpenses } from "@/lib/parseExpenses";
import { formatAmount } from "@/lib/format";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

// Always 200 so Telegram doesn't retry the update.
const ok = () => NextResponse.json({ ok: true });

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number; username?: string };
  };
};

export async function POST(request: Request) {
  // 1. Verify the secret token Telegram sends with each webhook call.
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return ok();
  }

  // 2. Only handle text messages.
  const message = update.message;
  const text = message?.text;
  const chatId = message?.chat?.id;
  const telegramId = message?.from?.id;
  const username = message?.from?.username ?? null;

  if (!text || chatId == null || telegramId == null) {
    return ok();
  }

  const supabase = createAdminClient();

  try {
    const trimmed = text.trim();

    if (trimmed.startsWith("/start")) {
      const code = trimmed.split(/\s+/)[1];

      // 4. /start with no code.
      if (!code) {
        await sendMessage(
          chatId,
          "Salom! Hisobingizni ulash uchun ilovadagi Telegram sahifasidan ulanish kodini oling.",
        );
        return ok();
      }

      // 3. /start <code>: look up a valid, unused, unexpired code.
      const { data: codeRow } = await supabase
        .from("telegram_codes")
        .select("code, user_id, expires_at, used")
        .eq("code", code)
        .maybeSingle();

      const expired =
        !codeRow || new Date(codeRow.expires_at).getTime() < Date.now();

      if (!codeRow || codeRow.used || expired) {
        await sendMessage(
          chatId,
          "Kod yaroqsiz yoki muddati o'tgan. Iltimos, ilovadan yangi ulanish kodini oling.",
        );
        return ok();
      }

      const { error: upsertErr } = await supabase.from("telegram_links").upsert(
        {
          telegram_id: telegramId,
          user_id: codeRow.user_id,
          telegram_username: username,
        },
        { onConflict: "telegram_id" },
      );

      if (upsertErr) {
        console.error("telegram_links upsert error:", upsertErr);
        await sendMessage(chatId, "Ulashda xatolik. Keyinroq urinib ko'ring.");
        return ok();
      }

      await supabase
        .from("telegram_codes")
        .update({ used: true })
        .eq("code", code);

      await sendMessage(
        chatId,
        "✅ Hisobingiz ulandi! Endi xarajat yozing, masalan: Taksi 20 Somsa 18",
      );
      return ok();
    }

    // 5. Any other text: the sender must be linked.
    const { data: link } = await supabase
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (!link) {
      await sendMessage(
        chatId,
        "Hisobingiz ulanmagan. Iltimos, ilovadagi Telegram sahifasidan ulang.",
      );
      return ok();
    }

    let parsed;
    try {
      parsed = await parseExpenses(trimmed);
    } catch (err) {
      console.error("Telegram parse error:", err);
      await sendMessage(
        chatId,
        "Tahlil qilishda xatolik. Qayta urinib ko'ring.",
      );
      return ok();
    }

    if (parsed.length === 0) {
      await sendMessage(
        chatId,
        "Tushunolmadim 🤔 Masalan shunday yozing: Taksi 20 Somsa 18",
      );
      return ok();
    }

    const rows = parsed.map((p) => ({
      user_id: link.user_id,
      raw_text: p.note,
      note: p.note,
      amount: p.amount,
      category: p.category,
      currency: "UZS",
    }));

    const { error: insertErr } = await supabase.from("expenses").insert(rows);
    if (insertErr) {
      console.error("Telegram insert error:", insertErr);
      await sendMessage(chatId, "Saqlashda xatolik. Qayta urinib ko'ring.");
      return ok();
    }

    const lines = parsed.map(
      (p) => `• ${p.note} — ${formatAmount(p.amount)} (${p.category})`,
    );
    const total = parsed.reduce((sum, p) => sum + p.amount, 0);
    await sendMessage(
      chatId,
      `✅ Saqlandi:\n${lines.join("\n")}\nJami: ${formatAmount(total)}`,
    );
    return ok();
  } catch (err) {
    // Never fail the webhook — log and acknowledge so Telegram won't retry.
    console.error("Telegram webhook error:", err);
    return ok();
  }
}
