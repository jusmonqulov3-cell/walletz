import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendMessage,
  answerCallbackQuery,
  editMessageText,
  getFileUrl,
  downloadFileAsBase64,
  type InlineKeyboardMarkup,
} from "@/lib/telegram";
import { generateJSON, generateJSONFromAudio } from "@/lib/gemini";
import {
  transactionInstruction,
  normalizeTransactions,
  type ParsedTransactions,
} from "@/lib/parseTransactions";
import { formatAmount } from "@/lib/format";
import { isoFromDaysAgo, daysAgoLabel } from "@/lib/dates";
import { appUrl } from "@/lib/appUrl";

// Allow up to 30s for the Gemini round-trip on Vercel.
export const maxDuration = 30;

// Always 200 so Telegram doesn't retry the update.
const ok = () => NextResponse.json({ ok: true });

type Db = ReturnType<typeof createAdminClient>;

type TgUser = { id?: number; username?: string };
type TgMessage = {
  text?: string;
  chat?: { id?: number };
  from?: TgUser;
  voice?: { file_id?: string };
};
type TgCallbackQuery = {
  id: string;
  from?: TgUser;
  message?: { chat?: { id?: number }; message_id?: number };
  data?: string;
};
type TelegramUpdate = {
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
};

// Human-readable summary of understood items, grouped by type.
function summarize(p: ParsedTransactions): string {
  const lines: string[] = [];
  if (p.expenses.length) {
    lines.push("💸 Xarajatlar:");
    for (const e of p.expenses) {
      const when = daysAgoLabel(e.daysAgo);
      lines.push(
        `• ${e.note} — ${formatAmount(e.amount)} (${e.category})${
          when ? ` · 📅 ${when}` : ""
        }`,
      );
    }
  }
  if (p.incomes.length) {
    lines.push("💰 Daromad:");
    for (const i of p.incomes) {
      const when = daysAgoLabel(i.daysAgo);
      lines.push(
        `• ${i.source} — ${formatAmount(i.amount)}${
          when ? ` · 📅 ${when}` : ""
        }`,
      );
    }
  }
  if (p.debts.length) {
    lines.push("🤝 Qarz:");
    for (const d of p.debts) {
      const dir = d.direction === "lent" ? "berdim" : "oldim";
      lines.push(`• ${d.person} — ${formatAmount(d.amount)} (${dir})`);
    }
  }
  return lines.join("\n");
}

// A single button that opens the Mini App.
function openAppKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📊 Ilovani ochish", web_app: { url: `${appUrl()}/dashboard` } }],
    ],
  };
}

// Confirm / cancel / edit buttons shown under an understood payload.
function confirmKeyboard(pendingId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Tasdiqlash", callback_data: `c:${pendingId}` },
        { text: "❌ Bekor", callback_data: `x:${pendingId}` },
      ],
      [{ text: "✏️ Tahrirlash", callback_data: `e:${pendingId}` }],
    ],
  };
}

// Reassures the user while a voice message is being transcribed: it edits the
// given message every few seconds with the elapsed time. Returns a stop()
// function that halts the ticker and waits for any in-flight edit to settle, so
// the caller can safely overwrite the same message afterwards.
function startProgress(
  chatId: number,
  messageId: number,
): () => Promise<void> {
  let stopped = false;
  let wake: (() => void) | null = null;

  // setTimeout-based sleep that stop() can cut short, so we never linger.
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      wake = () => {
        clearTimeout(t);
        resolve();
      };
    });

  const loop = (async () => {
    let elapsed = 0;
    while (!stopped) {
      await sleep(3000);
      if (stopped) break;
      elapsed += 3;
      await editMessageText(
        chatId,
        messageId,
        `🎤 Ovoz tahlil qilinmoqda… (${elapsed}s)\n⏳ Odatda 10–25 soniya, biroz kuting.`,
      );
    }
  })();

  return async () => {
    stopped = true;
    wake?.();
    await loop;
  };
}

// --- /start linking (unchanged behavior) ----------------------------------

async function handleStart(
  text: string,
  chatId: number,
  telegramId: number,
  username: string | null,
  supabase: Db,
): Promise<void> {
  const code = text.split(/\s+/)[1];

  // Bare /start.
  if (!code) {
    await sendMessage(
      chatId,
      "Salom! Hisobingizni ulash uchun ilovadagi Telegram sahifasidan ulanish kodini oling.",
    );
    return;
  }

  // /start <code>: look up a valid, unused, unexpired code.
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
    return;
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
    return;
  }

  await supabase.from("telegram_codes").update({ used: true }).eq("code", code);

  await sendMessage(
    chatId,
    "✅ Hisobingiz ulandi! Endi xarajat, daromad yoki qarzni yozing — yoki ovozli xabar yuboring.\n\n🔔 Haftalik hisobot va ogohlantirishlarni olish uchun /resume yuboring.",
    openAppKeyboard(),
  );
}

// --- Inline-button confirm / cancel ---------------------------------------

async function handleCallback(
  cb: TgCallbackQuery,
  supabase: Db,
): Promise<void> {
  const fromId = cb.from?.id;
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const match = /^([cex]):(.+)$/.exec(cb.data ?? "");

  if (!match || fromId == null) {
    await answerCallbackQuery(cb.id);
    return;
  }

  const action = match[1];
  const pendingId = match[2];

  // Load the pending row and verify it belongs to the tapping user.
  const { data: pending } = await supabase
    .from("telegram_pending")
    .select("id, user_id, payload")
    .eq("id", pendingId)
    .eq("telegram_id", fromId)
    .maybeSingle();

  if (!pending) {
    await answerCallbackQuery(cb.id, "Allaqachon qayta ishlangan");
    return;
  }

  // Edit: flag the row so the user's next message replaces its payload.
  if (action === "e") {
    await supabase
      .from("telegram_pending")
      .update({ editing: true })
      .eq("id", pendingId);
    await answerCallbackQuery(cb.id, "Tahrirlash");
    if (chatId != null && messageId != null) {
      await editMessageText(
        chatId,
        messageId,
        "✏️ To'g'rilangan ma'lumotni yuboring — matn yoki ovozli xabar.",
      );
    }
    return;
  }

  // Cancel.
  if (action === "x") {
    await supabase.from("telegram_pending").delete().eq("id", pendingId);
    await answerCallbackQuery(cb.id, "Bekor qilindi");
    if (chatId != null && messageId != null) {
      await editMessageText(chatId, messageId, "❌ Bekor qilindi");
    }
    return;
  }

  // Confirm: insert every item into its table (re-normalized defensively).
  const norm = normalizeTransactions(pending.payload);
  const userId = pending.user_id as string;
  let failed = false;

  if (norm.expenses.length) {
    const { error } = await supabase.from("expenses").insert(
      norm.expenses.map((e) => ({
        user_id: userId,
        raw_text: e.note,
        note: e.note,
        amount: e.amount,
        category: e.category,
        currency: "UZS",
        spent_at: isoFromDaysAgo(e.daysAgo),
      })),
    );
    if (error) {
      console.error("Telegram expenses insert error:", error);
      failed = true;
    }
  }
  if (norm.incomes.length) {
    const { error } = await supabase.from("incomes").insert(
      norm.incomes.map((i) => ({
        user_id: userId,
        source: i.source,
        amount: i.amount,
        received_at: isoFromDaysAgo(i.daysAgo),
      })),
    );
    if (error) {
      console.error("Telegram incomes insert error:", error);
      failed = true;
    }
  }
  if (norm.debts.length) {
    const { error } = await supabase.from("debts").insert(
      norm.debts.map((d) => ({
        user_id: userId,
        person: d.person,
        amount: d.amount,
        direction: d.direction,
      })),
    );
    if (error) {
      console.error("Telegram debts insert error:", error);
      failed = true;
    }
  }

  if (failed) {
    // Keep the pending row so the user can retry the confirmation.
    await answerCallbackQuery(cb.id, "Xatolik");
    if (chatId != null && messageId != null) {
      await editMessageText(
        chatId,
        messageId,
        "❌ Saqlashda xatolik. Qayta urinib ko'ring.",
      );
    }
    return;
  }

  await supabase.from("telegram_pending").delete().eq("id", pendingId);
  await answerCallbackQuery(cb.id, "Saqlandi");
  if (chatId != null && messageId != null) {
    await editMessageText(
      chatId,
      messageId,
      `✅ Saqlandi:\n${summarize(norm)}`,
      openAppKeyboard(),
    );
  }
}

// --- Notification opt-in (/resume) and opt-out (/stop) ---------------------

async function handleNotifyToggle(
  enable: boolean,
  chatId: number,
  telegramId: number,
  supabase: Db,
): Promise<void> {
  const { data: link } = await supabase
    .from("telegram_links")
    .select("telegram_id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (!link) {
    await sendMessage(
      chatId,
      "Hisobingiz ulanmagan. Avval ilovadagi Telegram sahifasidan ulang.",
    );
    return;
  }

  await supabase
    .from("telegram_links")
    .update({ notify: enable })
    .eq("telegram_id", telegramId);

  await sendMessage(
    chatId,
    enable
      ? "🔔 Bildirishnomalar yoqildi — haftalik hisobot va ogohlantirishlar. O'chirish: /stop"
      : "🔕 Bildirishnomalar o'chirildi. Qayta yoqish: /resume",
  );
}

// --- Incoming voice / text messages ---------------------------------------

async function handleMessage(message: TgMessage, supabase: Db): Promise<void> {
  const chatId = message.chat?.id;
  const telegramId = message.from?.id;
  const username = message.from?.username ?? null;
  if (chatId == null || telegramId == null) return;

  const text = typeof message.text === "string" ? message.text.trim() : "";

  if (text.startsWith("/start")) {
    await handleStart(text, chatId, telegramId, username, supabase);
    return;
  }

  if (text === "/resume" || text === "/stop") {
    await handleNotifyToggle(text === "/resume", chatId, telegramId, supabase);
    return;
  }

  const isVoice = typeof message.voice?.file_id === "string";
  // Ignore empty messages and unknown slash-commands.
  if (!isVoice && (!text || text.startsWith("/"))) return;

  // Sender must be linked.
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
    return;
  }

  // Voice takes several seconds to transcribe — show an instant acknowledgment
  // and a live elapsed-time ticker on that same message while Gemini works.
  let statusMessageId: number | null = null;
  let stopProgress: (() => Promise<void>) | null = null;
  if (isVoice) {
    statusMessageId = await sendMessage(
      chatId,
      "🎤 Ovozli xabar qabul qilindi.\n⏳ Tahlil boshlanmoqda…",
    );
    if (statusMessageId != null) {
      stopProgress = startProgress(chatId, statusMessageId);
    }
  }

  // Replies by editing the status message when we have one (voice), so the
  // ticker, errors, and the final prompt all live on a single message.
  const reply = (body: string, keyboard?: InlineKeyboardMarkup) =>
    statusMessageId != null
      ? editMessageText(chatId, statusMessageId, body, keyboard)
      : sendMessage(chatId, body, keyboard);

  // Parse voice (Gemini transcribes + classifies) or text.
  let result: unknown;
  try {
    if (isVoice) {
      const fileUrl = await getFileUrl(message.voice!.file_id!);
      const base64 = fileUrl ? await downloadFileAsBase64(fileUrl) : null;
      if (!base64) {
        if (stopProgress) await stopProgress();
        await reply("Ovozni o'qib bo'lmadi. Qayta urinib ko'ring.");
        return;
      }
      result = await generateJSONFromAudio(
        transactionInstruction(),
        base64,
        "audio/ogg",
      );
    } else {
      result = await generateJSON(transactionInstruction(), text);
    }
  } catch (err) {
    console.error("Telegram parse error:", err);
    if (stopProgress) await stopProgress();
    await reply("Tahlil qilishda xatolik. Qayta urinib ko'ring.");
    return;
  }

  // Stop the ticker before we reuse the status message for the result.
  if (stopProgress) await stopProgress();

  const norm = normalizeTransactions(result);
  if (
    norm.expenses.length === 0 &&
    norm.incomes.length === 0 &&
    norm.debts.length === 0
  ) {
    await reply("Tushunmadim, qaytadan urinib ko'ring.");
    return;
  }

  // If the user tapped "✏️ Tahrirlash", replace that pending row's payload in
  // place; otherwise stash a fresh one. Either way we re-ask for confirmation.
  const { data: editingRow } = await supabase
    .from("telegram_pending")
    .select("id")
    .eq("telegram_id", telegramId)
    .eq("editing", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let pendingId: string;
  if (editingRow) {
    const { error } = await supabase
      .from("telegram_pending")
      .update({ payload: norm, editing: false })
      .eq("id", editingRow.id);
    if (error) {
      console.error("telegram_pending update error:", error);
      await reply("Xatolik. Qayta urinib ko'ring.");
      return;
    }
    pendingId = editingRow.id as string;
  } else {
    const { data: pending, error } = await supabase
      .from("telegram_pending")
      .insert({ user_id: link.user_id, telegram_id: telegramId, payload: norm })
      .select("id")
      .single();
    if (error || !pending) {
      console.error("telegram_pending insert error:", error);
      await reply("Xatolik. Qayta urinib ko'ring.");
      return;
    }
    pendingId = pending.id as string;
  }

  await reply(
    `Quyidagilarni tushundim:\n${summarize(norm)}\n\nTasdiqlaysizmi?`,
    confirmKeyboard(pendingId),
  );
}

export async function POST(request: Request) {
  // Verify the secret token Telegram sends with each webhook call.
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

  const supabase = createAdminClient();

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query, supabase);
    } else if (update.message) {
      await handleMessage(update.message, supabase);
    }
  } catch (err) {
    // Never fail the webhook — log and acknowledge so Telegram won't retry.
    console.error("Telegram webhook error:", err);
  }

  return ok();
}
