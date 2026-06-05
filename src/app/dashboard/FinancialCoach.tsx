"use client";

import { useState } from "react";

export default function FinancialCoach() {
  const [insights, setInsights] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Tahlil qilishda xatolik");
      setInsights(Array.isArray(data.insights) ? data.insights : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tahlil qilishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-700">
          🤖 Moliyaviy maslahatchi
        </h2>
        {insights !== null && (
          <button
            type="button"
            onClick={analyze}
            disabled={loading}
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60"
          >
            {loading ? "..." : "↻ Qayta tahlil"}
          </button>
        )}
      </div>

      {/* Initial state: prompt to analyze (no auto-call to save tokens). */}
      {insights === null && (
        <div className="mt-3">
          <p className="text-sm text-gray-500">
            Xarajatlaringiz bo&apos;yicha shaxsiy maslahatlar oling.
          </p>
          <button
            type="button"
            onClick={analyze}
            disabled={loading}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Tahlil qilinmoqda..." : "Tahlil qilish"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Results */}
      {insights !== null && !error && (
        <div className="mt-4">
          {insights.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
              Tahlil uchun yetarli ma&apos;lumot yo&apos;q — avval bir nechta
              xarajat kiriting.
            </p>
          ) : (
            <ul className="space-y-3">
              {insights.map((tip, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-800"
                >
                  <span aria-hidden className="shrink-0">
                    💡
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
