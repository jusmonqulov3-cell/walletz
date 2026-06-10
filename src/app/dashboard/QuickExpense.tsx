"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/categories";
import { formatAmount } from "@/lib/format";
import { todayYmd, ymdDaysAgo } from "@/lib/dates";

type ParsedItem = {
  note: string;
  amount: number;
  category: Category;
  // YYYY-MM-DD (Tashkent) the expense is dated to; defaults to today, but the
  // parser can backdate it ("kecha …") and the user can adjust the picker.
  date: string;
  confidence: number;
};

export default function QuickExpense() {
  const router = useRouter();
  const today = todayYmd();
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
      const raw: Array<Record<string, unknown>> = Array.isArray(data.expenses)
        ? data.expenses
        : [];
      // Turn the model's relative daysAgo into a concrete date for the picker.
      const parsed: ParsedItem[] = raw.map((e) => ({
        note: String(e.note ?? ""),
        amount: Number(e.amount) || 0,
        category: e.category as Category,
        date: ymdDaysAgo(Number(e.daysAgo) || 0),
        confidence: Number(e.confidence) || 0,
      }));
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
          expenses: items.map(({ note, amount, category, date }) => ({
            note,
            amount,
            category,
            date,
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
    <>
      {/* Input */}
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Masalan: Taksi 20 Somsa 18 Qahva 15"
          className="input resize-none"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11.5px] text-muted">
            Enter — tahlil, Shift+Enter — yangi qator
          </p>
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="btn"
            style={{ width: "auto", padding: "10px 16px" }}
          >
            {parsing ? "Tahlil qilinmoqda..." : "Qo'shish"}
          </button>
        </div>
        {parseError && (
          <p className="mt-3 text-[12.5px] font-medium text-negative">
            {parseError}
          </p>
        )}
      </div>

      {/* Editable preview */}
      {items.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="field-label" style={{ margin: "0 0 9px" }}>
            Tasdiqlang ({items.length})
          </div>
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    value={item.note}
                    onChange={(e) => updateItem(i, { note: e.target.value })}
                    className="input min-w-0 flex-1"
                    style={{ padding: "8px 11px" }}
                  />
                  {item.confidence < 0.6 && (
                    <span
                      className="badge-pill shrink-0"
                      style={{
                        background: "var(--warn-weak)",
                        color: "var(--warn)",
                      }}
                    >
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
                  className="input mono w-28 text-right"
                  style={{ padding: "8px 11px" }}
                />

                <select
                  value={item.category}
                  onChange={(e) =>
                    updateItem(i, { category: e.target.value as Category })
                  }
                  className="input"
                  style={{ width: "auto", padding: "8px 28px 8px 11px" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Date — defaults to today; lets the user log a forgotten
                    expense on an earlier day. Future dates are blocked. */}
                <input
                  type="date"
                  max={today}
                  value={item.date}
                  onChange={(e) =>
                    updateItem(i, { date: e.target.value || today })
                  }
                  className="input"
                  style={{ width: "auto", padding: "8px 11px" }}
                  title="Sana"
                />

                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label="O'chirish"
                  className="shrink-0 rounded-md px-2 py-1 text-muted transition hover:bg-[var(--subtle)] hover:text-foreground"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {saveError && (
            <p className="mt-3 text-[12.5px] font-medium text-negative">
              {saveError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] text-muted">
              Jami:{" "}
              <span className="mono font-semibold text-foreground">
                {formatAmount(
                  items.reduce((sum, it) => sum + (it.amount || 0), 0),
                )}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn"
              style={{ width: "auto", padding: "10px 16px" }}
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
