"use client";

import { useState } from "react";
import { formatAmount, formatDate } from "@/lib/format";

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
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {rows.map((e) => (
        <li
          key={e.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {e.note || "—"}
            </p>
            <p className="text-xs text-gray-500">
              {e.category || "Boshqa"} · {formatDate(e.spent_at)}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-gray-900">
            {formatAmount(e.amount)}
          </span>
        </li>
      ))}
    </ul>
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-700">
          {searching ? "Qidiruv natijalari" : "So'nggi xarajatlar"}
        </h2>
      </div>

      {/* Search box */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Qidiruv: masalan, Taksi"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "..." : "Qidirish"}
        </button>
        {searching && (
          <button
            type="button"
            onClick={clearSearch}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Tozalash
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Results or recent */}
      {searching ? (
        <>
          <p className="mb-3 text-sm text-gray-500">
            Topildi: {result.count} ta · jami{" "}
            <span className="font-medium text-gray-900">
              {formatAmount(result.total)}
            </span>
          </p>
          {result.count === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              Hech narsa topilmadi — boshqa so&apos;z kiriting
            </div>
          ) : (
            <ExpenseList rows={result.expenses} />
          )}
        </>
      ) : recent.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-900">
            Birinchi xarajatingizni kiriting ↑
          </p>
        </div>
      ) : (
        <ExpenseList rows={recent} />
      )}
    </section>
  );
}
