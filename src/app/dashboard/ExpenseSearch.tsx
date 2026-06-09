"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount, formatDate } from "@/lib/format";
import { CATEGORIES, categoryColor } from "@/lib/categories";

type ExpenseRow = {
  id: string;
  note: string | null;
  amount: number;
  category: string | null;
  spent_at: string;
};

type SearchResult = {
  expenses: ExpenseRow[];
  count: number;
  total: number;
};

// A single expense row with inline edit + delete.
function ExpenseRowItem({
  row,
  onDeleted,
  onUpdated,
}: {
  row: ExpenseRow;
  onDeleted: (id: string) => void;
  onUpdated: (row: ExpenseRow) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(row.note ?? "");
  const [amount, setAmount] = useState(String(row.amount));
  const [category, setCategory] = useState(row.category ?? "Boshqa");
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
    try {
      const res = await fetch("/api/expenses/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          note: note.trim(),
          amount: Math.round(amt),
          category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      onUpdated({
        ...row,
        note: note.trim(),
        amount: Math.round(amt),
        category,
      });
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
    if (!confirm("Bu xarajatni o'chirasizmi?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses/delete", {
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
      <div className="badge" style={{ background: "var(--subtle)" }}>
        <span style={{ background: categoryColor(row.category) }} />
      </div>
      <div className="meta">
        <div className="m1 truncate">{row.note || "—"}</div>
        <div className="m2">
          {row.category || "Boshqa"} · {formatDate(row.spent_at)}
        </div>
      </div>
      <div className="right flex items-center gap-1.5">
        <div className="ramt mono">{formatAmount(row.amount)}</div>
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
            Izoh
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
          <label className="text-[12px] text-muted">
            Turkum
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input mt-1 block w-36"
              style={{ padding: "8px 11px" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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

function ExpenseList({ rows }: { rows: ExpenseRow[] }) {
  const [items, setItems] = useState(rows);

  // Keep local state in sync when the source rows change (search ↔ recent).
  const [lastRows, setLastRows] = useState(rows);
  if (rows !== lastRows) {
    setLastRows(rows);
    setItems(rows);
  }

  return (
    <div className="card list">
      {items.map((e) => (
        <ExpenseRowItem
          key={e.id}
          row={e}
          onDeleted={(id) => setItems((prev) => prev.filter((r) => r.id !== id))}
          onUpdated={(updated) =>
            setItems((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r)),
            )
          }
        />
      ))}
    </div>
  );
}

export default function ExpenseSearch({ recent }: { recent: ExpenseRow[] }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    const q = query.trim();
    if (!q) {
      clearSearch();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Qidiruvda xatolik");
      setResult(data as SearchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qidiruvda xatolik");
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setResult(null);
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  }

  const searching = result !== null;

  return (
    <section>
      <div className="section-head">
        <h2>{searching ? "Qidiruv natijalari" : "So'nggi xarajatlar"}</h2>
      </div>

      {/* Search box */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Qidiruv: masalan, Taksi"
          className="input flex-1"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="btn"
          style={{ width: "auto", padding: "11px 16px" }}
        >
          {loading ? "..." : "Qidirish"}
        </button>
        {searching && (
          <button
            type="button"
            onClick={clearSearch}
            className="btn ghost"
            style={{ width: "auto", padding: "11px 14px" }}
          >
            Tozalash
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-[12.5px] font-medium text-negative">{error}</p>
      )}

      {/* Results or recent */}
      {searching ? (
        <>
          <p className="mb-3 text-[13px] text-muted">
            Topildi: {result.count} ta · jami{" "}
            <span className="mono font-semibold text-foreground">
              {formatAmount(result.total)}
            </span>
          </p>
          {result.count === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="et">Hech narsa topilmadi</div>
                <div className="ex">Boshqa so&apos;z bilan urinib ko&apos;ring.</div>
              </div>
            </div>
          ) : (
            <ExpenseList rows={result.expenses} />
          )}
        </>
      ) : recent.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="eic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            </div>
            <div className="et">Hali xarajat yo&apos;q</div>
            <div className="ex">Birinchi xarajatingizni yuqoridan kiriting.</div>
          </div>
        </div>
      ) : (
        <ExpenseList rows={recent} />
      )}
    </section>
  );
}
