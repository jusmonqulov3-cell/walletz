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

  // Initial: prompt to analyze (no auto-call to save tokens).
  if (insights === null) {
    return (
      <div className="card card-pad">
        <p className="text-[13px] text-muted">
          Xarajatlaringiz bo&apos;yicha shaxsiy maslahatlar oling.
        </p>
        {error && (
          <p className="mt-3 text-[12.5px] font-medium text-negative">{error}</p>
        )}
        <button
          type="button"
          onClick={analyze}
          disabled={loading}
          className="btn mt-3"
          style={{ width: "auto", padding: "10px 16px" }}
        >
          {loading ? "Tahlil qilinmoqda..." : "Tahlil qilish"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="card tip danger">
          <div className="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <div className="body">
            <div className="tx">{error}</div>
          </div>
        </div>
      )}

      {insights.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="eic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
              </svg>
            </div>
            <div className="et">Tahlil uchun ma&apos;lumot yetarli emas</div>
            <div className="ex">Avval bir nechta xarajat kiriting.</div>
          </div>
        </div>
      ) : (
        insights.map((tip, i) => (
          <div className="card tip" key={i}>
            <div className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
              </svg>
            </div>
            <div className="body">
              <div className="tx">{tip}</div>
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={analyze}
        disabled={loading}
        className="link mt-3 text-[13px] font-medium text-accent hover:underline disabled:opacity-60"
      >
        {loading ? "..." : "↻ Qayta tahlil"}
      </button>
    </div>
  );
}
