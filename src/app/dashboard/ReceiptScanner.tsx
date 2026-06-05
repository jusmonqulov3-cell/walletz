"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category, toCategory } from "@/lib/categories";
import { formatAmount } from "@/lib/format";

type ReceiptItem = {
  note: string;
  amount: number;
  category: Category;
  confidence: number;
};

// Downscale an image file to max ~1500px on its longest side and re-encode as
// JPEG (~0.8). Returns the base64 payload (no data: prefix) and mime type.
function downscaleImage(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Rasmni yuklab bo'lmadi"));
      img.onload = () => {
        const MAX = 1500;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas mavjud emas"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve({ base64, mimeType: "image/jpeg" });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// The category that appears most often across the parsed items.
function mostCommonCategory(items: ReceiptItem[]): Category {
  const counts = new Map<Category, number>();
  for (const it of items) {
    counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
  }
  let best: Category = "Boshqa";
  let bestCount = -1;
  for (const [cat, count] of counts) {
    if (count > bestCount) {
      best = cat;
      bestCount = count;
    }
  }
  return best;
}

export default function ReceiptScanner() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [collapse, setCollapse] = useState(false);

  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function reset() {
    setItems([]);
    setMerchant(null);
    setTotal(null);
    setCollapse(false);
    setSaveError(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Allow re-picking the same file later.
    e.target.value = "";
    if (!file || reading) return;

    setReading(true);
    setReadError(null);
    reset();

    try {
      const { base64, mimeType } = await downscaleImage(file);
      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Chekni o'qib bo'lmadi");

      const parsed: ReceiptItem[] = Array.isArray(data.expenses)
        ? data.expenses.map((it: ReceiptItem) => ({
            note: it.note,
            amount: it.amount,
            category: toCategory(it.category),
            confidence: it.confidence,
          }))
        : [];

      if (parsed.length === 0) {
        setReadError("Chekni o'qib bo'lmadi, qaytadan urinib ko'ring.");
        return;
      }

      setItems(parsed);
      setMerchant(typeof data.merchant === "string" ? data.merchant : null);
      setTotal(
        typeof data.total === "number" && data.total > 0 ? data.total : null,
      );
    } catch (err) {
      setReadError(
        err instanceof Error
          ? err.message
          : "Chekni o'qib bo'lmadi, qaytadan urinib ko'ring.",
      );
    } finally {
      setReading(false);
    }
  }

  function updateItem(index: number, patch: Partial<ReceiptItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const itemsTotal = items.reduce((sum, it) => sum + (it.amount || 0), 0);
  // When collapsing, prefer the receipt's printed grand total; fall back to the
  // sum of line items if no total was detected.
  const collapsedAmount = total ?? itemsTotal;

  async function handleSave() {
    if (items.length === 0 || saving) return;

    setSaving(true);
    setSaveError(null);

    const payload = collapse
      ? [
          {
            note: merchant || "Chek",
            amount: collapsedAmount,
            category: mostCommonCategory(items),
          },
        ]
      : items.map(({ note, amount, category }) => ({ note, amount, category }));

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Saqlashda xatolik");
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
        >
          📷 Chek rasmi
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Chek rasmi</h3>
            <button
              type="button"
              onClick={() => {
                reset();
                setReadError(null);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              Yopish
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={reading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reading ? "Chek o'qilmoqda..." : "📷 Rasm tanlash yoki suratga olish"}
          </button>

          {readError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {readError}
            </p>
          )}
        </div>
      )}

      {/* Editable preview */}
      {items.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          {merchant && (
            <p className="mb-3 text-sm font-semibold text-gray-900">
              🧾 {merchant}
            </p>
          )}

          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={collapse}
              onChange={(e) => setCollapse(e.target.checked)}
            />
            Bitta xarajat sifatida saqlash (jami)
          </label>

          {collapse ? (
            <div className="rounded-lg border border-gray-200 p-3 text-sm">
              <span className="font-medium text-gray-900">
                {merchant || "Chek"}
              </span>{" "}
              — {formatAmount(collapsedAmount)} ·{" "}
              {mostCommonCategory(items)}
            </div>
          ) : (
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
          )}

          {saveError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {saveError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Jami:{" "}
              <span className="font-medium text-gray-900">
                {formatAmount(collapse ? collapsedAmount : itemsTotal)}
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
    </>
  );
}
