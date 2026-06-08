"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

export default function TelegramConnect({
  linked,
  username,
}: {
  linked: boolean;
  username: string | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateCode() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/link-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      setCode(data.code as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  async function unlink() {
    if (unlinking) return;
    setUnlinking(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/unlink", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setUnlinking(false);
    }
  }

  if (linked) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-base font-medium text-positive">
          ✅ Telegram ulangan
        </p>
        {username && (
          <p className="mt-1 text-sm text-muted">@{username}</p>
        )}
        <p className="mt-3 text-sm text-muted">
          Botga xarajat yozing, masalan: <b>Taksi 20 Somsa 18</b>
        </p>
        {error && <p className="mt-3 text-sm text-negative">{error}</p>}
        <button
          type="button"
          onClick={unlink}
          disabled={unlinking}
          className="mt-4 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-[var(--subtle)] disabled:opacity-60"
        >
          {unlinking ? "..." : "Uzish"}
        </button>
      </div>
    );
  }

  const botLink =
    code && BOT_USERNAME
      ? `https://t.me/${BOT_USERNAME}?start=${code}`
      : null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <p className="text-sm text-muted">
        Telegram orqali xarajatlaringizni bevosita botga yozib qo&apos;shing.
      </p>

      {!code ? (
        <button
          type="button"
          onClick={generateCode}
          disabled={loading}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
        >
          {loading ? "..." : "Telegramga ulash"}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Quyidagi tugma orqali botni oching.</li>
            <li>
              Botda <b>Start</b> tugmasini bosing — hisobingiz avtomatik ulanadi.
            </li>
            <li>Kod 15 daqiqa amal qiladi.</li>
          </ol>

          {botLink ? (
            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-[var(--accent-strong)]"
            >
              Botni ochish
            </a>
          ) : (
            <p className="text-sm text-warn">
              Kod: <b>{code}</b> — bot nomi sozlanmagan, kodni botga{" "}
              <code>/start {code}</code> ko&apos;rinishida yuboring.
            </p>
          )}

          <button
            type="button"
            onClick={() => router.refresh()}
            className="block text-sm text-muted underline hover:text-foreground"
          >
            Ulagandan so&apos;ng — tekshirish
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}
    </div>
  );
}
