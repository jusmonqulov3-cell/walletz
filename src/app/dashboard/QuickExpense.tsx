"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/categories";
import { formatAmount } from "@/lib/format";

type ParsedItem = {
  note: string;
  amount: number;
  category: Category;
  confidence: number;
};

export default function QuickExpense() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [items, setItems] = useState<ParsedItem[]>([]);

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleParse() {
    const trimmed = text.trim();
    if (!trimmed || parsing) return;

    setParsing(true);
    setParseError(null);
    setSaveError(null);

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Tahlil qilishda xatolik");
      }
      const parsed: ParsedItem[] = Array.isArray(data.expenses)
        ? data.expenses
        : [];
      setItems(parsed);
      if (parsed.length === 0) {
        setParseError("Hech qanday xarajat aniqlanmadi.");
      }
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Tahlil qilishda xatolik",
      );
    } finally {
      setParsing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleParse();
    }
  }

  function updateItem(index: number, patch: Partial<ParsedItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (items.length === 0 || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenses: items.map(({ note, amount, category }) => ({
            note,
            amount,
            category,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Saqlashda xatolik");
      }
      // Success: clear input + preview, refresh the recent list below.
      setText("");
      setItems([]);
      router.refresh();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Saqlashda xatolik",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Input */}
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Masalan: Taksi 20 Somsa 18 Qahva 15"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Enter — tahlil qilish, Shift+Enter — yangi qator
          </p>
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {parsing ? "Tahlil qilinmoqda..." : "Qo'shish"}
          </button>
        </div>
        {parseError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {parseError}
          </p>
        )}
      </div>

      {/* Editable preview */}
      {items.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <h3 className="mb-3 text-sm font-medium text-gray-700">
            Tasdiqlang ({items.length})
          </h3>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    value={item.note}
                    onChange={(e) => updateItem(i, { note: e.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
                  />
                  {item.confidence < 0.6 && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      tekshiring
                    </span>
                  )}
                </div>

                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={item.amount}
                  onChange={(e) =>
                    updateItem(i, { amount: Number(e.target.value) || 0 })
                  }
                  className="w-28 rounded-md border border-gray-200 px-2 py-1.5 text-right text-sm text-gray-900 outline-none focus:border-gray-900"
                />

                <select
                  value={item.category}
                  onChange={(e) =>
                    updateItem(i, { category: e.target.value as Category })
                  }
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label="O'chirish"
                  className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {saveError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {saveError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Jami:{" "}
              <span className="font-medium text-gray-900">
                {formatAmount(
                  items.reduce((sum, it) => sum + (it.amount || 0), 0),
                )}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
