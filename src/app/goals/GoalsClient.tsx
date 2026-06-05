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
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-gray-900">{goal.title}</h3>
          <p className="text-sm text-gray-500">
            {formatAmount(saved)} / {formatAmount(target)}
          </p>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          aria-label="O'chirish"
          className="shrink-0 rounded-md px-2 py-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60"
        >
          ✕
        </button>
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${
              reached ? "bg-emerald-500" : "bg-gray-900"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
          <span>{Math.round(pct)}%</span>
          <span>
            {reached ? "✅ Maqsadga yetdingiz!" : `Qoldi: ${formatAmount(remaining)}`}
          </span>
        </div>
      </div>

      {/* Target-date math */}
      {goal.target_date && !reached && (
        <p className="mt-3 text-sm text-gray-600">
          {months !== null && months > 0 ? (
            <>
              {months} oy qoldi · oyiga{" "}
              <span className="font-medium text-gray-900">
                {formatAmount(requiredMonthly)}
              </span>{" "}
              jamlash kerak
            </>
          ) : (
            <>Muddat yaqin yoki o&apos;tgan — {formatAmount(remaining)} qoldi</>
          )}
        </p>
      )}

      {/* Contribute */}
      <div className="mt-4 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Summa"
          className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
        <button
          type="button"
          onClick={contribute}
          disabled={contributing || !amount}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {contributing ? "..." : "Pul qo'shish"}
        </button>
        <button
          type="button"
          onClick={getAdvice}
          disabled={adviceLoading}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
        >
          {adviceLoading ? "..." : "AI maslahat"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {advice && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          🤖 {advice}
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
    <div className="space-y-6">
      {/* Create form */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Maqsad (masalan, MacBook)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 sm:col-span-1"
          />
          <input
            type="number"
            inputMode="numeric"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="Summa (so'm)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <span className="text-xs text-gray-400">Sana ixtiyoriy</span>
          )}
          <button
            type="button"
            onClick={createGoal}
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? "..." : "Maqsad qo'shish"}
          </button>
        </div>
      </section>

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-900">
            Birinchi maqsadingizni qo&apos;shing — masalan, MacBook uchun 10 mln
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}
    </div>
  );
}
