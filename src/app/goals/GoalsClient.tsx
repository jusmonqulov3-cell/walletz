"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/lib/format";

export type Goal = {
  id: string;
  title: string;
  target_amount: number;
  saved_amount: number;
  target_date: string | null;
};

// Whole-month difference between today and the target date (Asia/Tashkent is
// close enough to local; this is a display estimate, the AI route is precise).
function monthsLeft(targetDate: string): number {
  const t = new Date(`${targetDate}T00:00:00`);
  const now = new Date();
  return (
    (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth())
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [contributing, setContributing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const saved = goal.saved_amount;
  const target = goal.target_amount;
  const remaining = Math.max(0, target - saved);
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const reached = saved >= target;

  const months = goal.target_date ? monthsLeft(goal.target_date) : null;
  const requiredMonthly =
    months !== null && months > 0 ? Math.ceil(remaining / months) : remaining;

  async function contribute() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0 || contributing) return;
    setContributing(true);
    setError(null);
    try {
      const res = await fetch("/api/goals/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id, amount: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      setAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setContributing(false);
    }
  }

  async function getAdvice() {
    if (adviceLoading) return;
    setAdviceLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/goals/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      setAdvice(data.advice as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setAdviceLoading(false);
    }
  }

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/goals/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
      setDeleting(false);
    }
  }

  return (
    <div className="card goal">
      <div className="g-top">
        <div
          className="g-ic"
          style={{
            background: reached ? "var(--positive-weak)" : "var(--accent-weak)",
            color: reached ? "var(--positive)" : "var(--accent)",
          }}
        >
          {reached ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="3.4" />
            </svg>
          )}
        </div>
        <div className="g-name">
          <div className="gt truncate">{goal.title}</div>
          <div className="gd">
            {goal.target_date && !reached
              ? months !== null && months > 0
                ? `${months} oy qoldi · oyiga ${formatAmount(requiredMonthly)}`
                : "Muddat yaqin yoki o'tgan"
              : reached
                ? "Maqsadga yetdingiz 🎉"
                : `Qoldi: ${formatAmount(remaining)}`}
          </div>
        </div>
        <div
          className="g-pct"
          style={{ color: reached ? "var(--positive)" : "var(--accent)" }}
        >
          {Math.round(pct)}%
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          aria-label="O'chirish"
          className="ml-1 shrink-0 rounded-md px-1.5 py-1 text-muted transition hover:bg-[var(--subtle)] hover:text-foreground disabled:opacity-60"
        >
          ✕
        </button>
      </div>

      <div className="bar">
        <i
          style={{
            width: `${pct}%`,
            background: reached ? "var(--positive)" : "var(--accent)",
          }}
        />
      </div>
      <div className="g-foot">
        <span className="cur mono">{formatAmount(saved)}</span>
        <span className="tgt">/ {formatAmount(target)}</span>
      </div>

      {/* Contribute */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Summa"
          className="input mono w-32"
          style={{ padding: "9px 12px" }}
        />
        <button
          type="button"
          onClick={contribute}
          disabled={contributing || !amount}
          className="btn"
          style={{ width: "auto", padding: "9px 14px" }}
        >
          {contributing ? "..." : "Pul qo'shish"}
        </button>
        <button
          type="button"
          onClick={getAdvice}
          disabled={adviceLoading}
          className="btn ghost"
          style={{ width: "auto", padding: "9px 14px" }}
        >
          {adviceLoading ? "..." : "AI maslahat"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-[12.5px] font-medium text-negative">{error}</p>
      )}

      {advice && (
        <div className="insight mt-3">
          <div className="it">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
            </svg>
            AI maslahat
          </div>
          {advice}
        </div>
      )}
    </div>
  );
}

export default function GoalsClient({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGoal() {
    const amount = Number(targetAmount);
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0 || saving) {
      setError("Nom va musbat summa kiriting");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          target_amount: amount,
          target_date: targetDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      setTitle("");
      setTargetAmount("");
      setTargetDate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Create form */}
      <section className="card card-pad">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Maqsad (masalan, MacBook)"
            className="input"
          />
          <input
            type="number"
            inputMode="numeric"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="Summa (so'm)"
            className="input mono"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="input"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {error ? (
            <p className="text-[12.5px] font-medium text-negative">{error}</p>
          ) : (
            <span className="text-[11.5px] text-muted">Sana ixtiyoriy</span>
          )}
          <button
            type="button"
            onClick={createGoal}
            disabled={saving}
            className="btn"
            style={{ width: "auto", padding: "10px 16px" }}
          >
            {saving ? "..." : "Maqsad qo'shish"}
          </button>
        </div>
      </section>

      {/* Goals list */}
      <div className="section">
        {goals.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="eic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="3.4" />
                </svg>
              </div>
              <div className="et">Hali maqsad yo&apos;q</div>
              <div className="ex">Birinchi maqsadingizni qo&apos;shing — masalan, MacBook uchun 10 mln.</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
