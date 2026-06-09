"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount, formatDate } from "@/lib/format";

export type IncomeRow = {
  id: string;
  source: string | null;
  amount: number;
  received_at: string;
};

// A single income row with inline edit + delete.
function IncomeRowItem({
  row,
  onDeleted,
  onUpdated,
}: {
  row: IncomeRow;
  onDeleted: (id: string) => void;
  onUpdated: (row: IncomeRow) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(row.source ?? "");
  const [amount, setAmount] = useState(String(row.amount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Summa musbat son bo'lishi kerak");
      setBusy(false);
      return;
    }
    if (!source.trim()) {
      setError("Manba kerak");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/incomes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          source: source.trim(),
          amount: Math.round(amt),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      onUpdated({ ...row, source: source.trim(), amount: Math.round(amt) });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!confirm("Bu daromadni o'chirasizmi?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/incomes/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      onDeleted(row.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
      setBusy(false);
    }
  }

  return (
    <div className="li flex-wrap">
      <div className="badge" style={{ background: "var(--positive-weak)" }}>
        <span style={{ background: "var(--positive)" }} />
      </div>
      <div className="meta">
        <div className="m1 truncate">{row.source || "—"}</div>
        <div className="m2">{formatDate(row.received_at)}</div>
      </div>
      <div className="right flex items-center gap-1.5">
        <div className="ramt pos mono">+{formatAmount(row.amount)}</div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label="Tahrirlash"
          className="rounded-md px-1.5 py-1 text-muted transition hover:bg-[var(--subtle)] hover:text-foreground"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label="O'chirish"
          className="rounded-md px-1.5 py-1 text-muted transition hover:bg-[var(--subtle)] hover:text-foreground disabled:opacity-60"
        >
          ✕
        </button>
      </div>

      {editing && (
        <div className="mt-3 flex w-full flex-wrap items-end gap-2 rounded-[10px] bg-[var(--subtle)] p-3">
          <label className="text-[12px] text-muted">
            Manba
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="input mt-1 block w-40"
              style={{ padding: "8px 11px" }}
            />
          </label>
          <label className="text-[12px] text-muted">
            Summa (so&apos;m)
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input mono mt-1 block w-32"
              style={{ padding: "8px 11px" }}
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn"
            style={{ width: "auto", padding: "9px 14px" }}
          >
            {busy ? "..." : "Saqlash"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 w-full text-[11.5px] text-negative">{error}</p>
      )}
    </div>
  );
}

export default function IncomeList({ rows }: { rows: IncomeRow[] }) {
  const [items, setItems] = useState(rows);

  return (
    <div className="card list">
      {items.map((r) => (
        <IncomeRowItem
          key={r.id}
          row={r}
          onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
          onUpdated={(updated) =>
            setItems((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x)),
            )
          }
        />
      ))}
    </div>
  );
}
