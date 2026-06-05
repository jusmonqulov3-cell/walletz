"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/lib/format";

export default function BudgetCard({
  monthTotal,
  limit,
}: {
  monthTotal: number;
  limit: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(limit === null);
  const [value, setValue] = useState(limit ? String(limit) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Musbat son kiriting");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_limit: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Saqlashda xatolik");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  }

  const over = limit !== null && monthTotal > limit;
  const remaining = limit !== null ? limit - monthTotal : 0;
  const pct =
    limit && limit > 0 ? Math.min(100, (monthTotal / limit) * 100) : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">Qolgan budjet</p>

      {editing || limit === null ? (
        <div className="mt-2 space-y-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Oylik budjet"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? "..." : "Belgilash"}
            </button>
            {limit !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setValue(String(limit));
                }}
                className="text-xs text-gray-400 hover:text-gray-700"
              >
                Bekor qilish
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="mt-1">
          <p
            className={`text-lg font-semibold ${
              over ? "text-red-600" : "text-gray-900"
            }`}
          >
            {formatAmount(remaining)}
          </p>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${
                over ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            {over ? (
              <span className="text-xs font-medium text-red-600">
                Budjet oshib ketdi
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {formatAmount(limit)} dan
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 underline hover:text-gray-900"
            >
              o&apos;zgartirish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
