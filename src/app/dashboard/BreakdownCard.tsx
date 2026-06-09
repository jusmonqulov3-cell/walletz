"use client";

import { useEffect, useState } from "react";
import { formatAmount } from "@/lib/format";
import { categoryColor } from "@/lib/categories";

type Segment = { label: string; total: number; percent: number };
type BreakdownData = { type: "expense" | "income"; total: number; segments: Segment[] };
type Mode = "expense" | "income";

// Palette for income sources (which have no fixed category colors).
const INCOME_COLORS = [
  "#2F9E68", "#569A97", "#5E6AD2", "#C9924F",
  "#B97AA3", "#6E9D63", "#8A7BE0", "#7C9CC9",
];

function segmentColor(mode: Mode, label: string, index: number): string {
  return mode === "expense"
    ? categoryColor(label)
    : INCOME_COLORS[index % INCOME_COLORS.length];
}

// Compact display of a so'm amount → { v, u } (presentation only).
function compact(n: number): { v: string; u: string } {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return { v: m >= 10 ? m.toFixed(1) : m.toFixed(2), u: "mln" };
  }
  if (n >= 1_000) return { v: String(Math.round(n / 1_000)), u: "ming" };
  return { v: String(Math.round(n)), u: "so'm" };
}

const R = 80;
const C = 2 * Math.PI * R;

export default function BreakdownCard({
  initialFrom,
  initialTo,
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const [mode, setMode] = useState<Mode>("expense");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ from, to, type: mode });

    void (async () => {
      try {
        const res = await fetch(`/api/breakdown?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Xatolik");
        setData(json as BreakdownData);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Xatolik");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [from, to, mode]);

  const segments = data?.segments ?? [];
  const total = data?.total ?? 0;
  const fractions = segments.map((s) => (total > 0 ? s.total / total : 0));
  const arcs = segments.map((s, i) => ({
    color: segmentColor(mode, s.label, i),
    dash: fractions[i] * C,
    offset: fractions.slice(0, i).reduce((sum, f) => sum + f, 0) * C,
  }));
  const totalCompact = compact(total);
  const heading = mode === "expense" ? "Chiqim taqsimoti" : "Kirim taqsimoti";

  return (
    <div className="section">
      <div className="card chart-card">
        <div className="ch-head">
          <h3>{heading}</h3>
        </div>

        {/* Chiqim ↔ Kirim toggle */}
        <div className="seg mb-3">
          <button
            type="button"
            className={mode === "expense" ? "active" : ""}
            onClick={() => setMode("expense")}
          >
            Chiqim
          </button>
          <button
            type="button"
            className={mode === "income" ? "active" : ""}
            onClick={() => setMode("income")}
          >
            Kirim
          </button>
        </div>

        {/* Date range */}
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="text-[12px] text-muted">
            Dan
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="input mt-1 block"
              style={{ padding: "8px 11px" }}
            />
          </label>
          <label className="text-[12px] text-muted">
            Gacha
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="input mt-1 block"
              style={{ padding: "8px 11px" }}
            />
          </label>
        </div>

        {error ? (
          <p className="text-[12.5px] font-medium text-negative">{error}</p>
        ) : loading ? (
          <p className="py-6 text-center text-[13px] text-muted">Yuklanmoqda…</p>
        ) : segments.length === 0 ? (
          <div className="empty py-6">
            <div className="et">Ma&apos;lumot yo&apos;q</div>
            <div className="ex">Tanlangan oraliqda yozuvlar topilmadi.</div>
          </div>
        ) : (
          <>
            <div className="donut-wrap">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle
                  cx="100" cy="100" r={R} fill="none"
                  stroke="var(--track)" strokeWidth="26"
                />
                {arcs.map((s, i) => (
                  <circle
                    key={i}
                    cx="100" cy="100" r={R} fill="none"
                    stroke={s.color} strokeWidth="26"
                    strokeDasharray={`${s.dash} ${C - s.dash}`}
                    strokeDashoffset={-s.offset}
                    transform="rotate(-90 100 100)"
                  />
                ))}
              </svg>
              <div className="donut-center">
                <div className="t-lbl">Jami</div>
                <div className="t-val mono">{totalCompact.v}</div>
                <div className="t-unit">{totalCompact.u} so&apos;m</div>
              </div>
            </div>
            <div className="legend">
              {segments.map((c, i) => (
                <div className="row" key={c.label}>
                  <span
                    className="dot"
                    style={{ background: segmentColor(mode, c.label, i) }}
                  />
                  <span className="nm">{c.label}</span>
                  <span className="pc">{c.percent}%</span>
                  <span className="am mono">{formatAmount(c.total)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
