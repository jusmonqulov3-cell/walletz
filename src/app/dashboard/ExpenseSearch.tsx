"use client";

import { useState } from "react";
import { formatAmount, formatDate } from "@/lib/format";
import { categoryColor } from "@/lib/categories";

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

function ExpenseList({ rows }: { rows: ExpenseRow[] }) {
  return (
    <div className="card list">
      {rows.map((e) => (
        <div className="li" key={e.id}>
          <div className="badge" style={{ background: "var(--subtle)" }}>
            <span style={{ background: categoryColor(e.category) }} />
          </div>
          <div className="meta">
            <div className="m1 truncate">{e.note || "—"}</div>
            <div className="m2">
              {e.category || "Boshqa"} · {formatDate(e.spent_at)}
            </div>
          </div>
          <div className="right">
            <div className="ramt mono">{formatAmount(e.amount)}</div>
          </div>
        </div>
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
