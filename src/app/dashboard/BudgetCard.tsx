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

  if (editing || limit === null) {
    return (
      <div className="budget">
        <div className="top">
          <div className="lbl">Oylik budjet</div>
        </div>
        <div className="amount-field" style={{ marginTop: 10 }}>
          <input
            className="mono"
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            aria-label="Oylik budjet"
          />
          <span className="cur">so&apos;m</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn"
            style={{ width: "auto", padding: "10px 16px" }}
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
              className="text-[12.5px] font-medium text-muted hover:text-foreground"
            >
              Bekor qilish
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-[12px] font-medium text-negative">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="budget">
      <div className="top">
        <div className="lbl">Oylik budjet</div>
        <div className="pct">{Math.round(pct)}%</div>
      </div>
      <div className="amt">
        <b className="mono">{formatAmount(monthTotal)}</b>
        <span>/ {formatAmount(limit)}</span>
      </div>
      <div className="bar">
        <i
          style={{
            width: `${pct}%`,
            background: over ? "var(--negative)" : "var(--accent)",
          }}
        />
      </div>
      <div className="foot">
        {over ? (
          <span style={{ color: "var(--negative)", fontWeight: 600 }}>
            Budjet oshib ketdi
          </span>
        ) : (
          <span>
            <b className="mono">{formatAmount(remaining)}</b> qoldi
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          o&apos;zgartirish
        </button>
      </div>
    </div>
  );
}
