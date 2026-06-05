"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount, formatDate } from "@/lib/format";

export type Direction = "borrowed" | "lent";

export type Debt = {
  id: string;
  person: string;
  amount: number;
  direction: Direction;
  note: string | null;
  settled: boolean;
  created_at: string;
};

type ParsedDebt = { person: string; amount: number; direction: Direction };

// 'borrowed' = the user took money (oldim); 'lent' = the user gave money (berdim).
const DIRECTION_LABEL: Record<Direction, string> = {
  borrowed: "oldim",
  lent: "berdim",
};

// Small segmented borrowed/lent toggle reused by the parse preview.
function DirectionToggle({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (d: Direction) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-200">
      {(["borrowed", "lent"] as Direction[]).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`px-2.5 py-1.5 text-xs font-medium transition ${
            value === d
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          {DIRECTION_LABEL[d]}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick AI input → editable preview → save
// ---------------------------------------------------------------------------

function QuickDebt() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedDebt | null>(null);

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleParse() {
    const trimmed = text.trim();
    if (!trimmed || parsing) return;

    setParsing(true);
    setParseError(null);
    setSaveError(null);

    try {
      const res = await fetch("/api/debts/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Tahlil qilishda xatolik");
      setPreview(data.debt as ParsedDebt);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Tahlil qilishda xatolik",
      );
    } finally {
      setParsing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleParse();
    }
  }

  async function handleSave() {
    if (!preview || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Saqlashda xatolik");
      setText("");
      setPreview(null);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Masalan: Azizdan 500 ming oldim"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Enter — tahlil qilish, Shift+Enter — yangi qator
          </p>
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {parsing ? "Tahlil qilinmoqda..." : "Qo'shish"}
          </button>
        </div>
        {parseError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {parseError}
          </p>
        )}
      </div>

      {preview && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Tasdiqlang</h3>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2">
            <input
              value={preview.person}
              onChange={(e) =>
                setPreview({ ...preview, person: e.target.value })
              }
              placeholder="Ism"
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={preview.amount}
              onChange={(e) =>
                setPreview({ ...preview, amount: Number(e.target.value) || 0 })
              }
              className="w-32 rounded-md border border-gray-200 px-2 py-1.5 text-right text-sm text-gray-900 outline-none focus:border-gray-900"
            />
            <DirectionToggle
              value={preview.direction}
              onChange={(direction) => setPreview({ ...preview, direction })}
            />
          </div>

          {saveError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {saveError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Manual add form (fallback)
// ---------------------------------------------------------------------------

function ManualDebt() {
  const router = useRouter();
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<Direction>("borrowed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const value = Number(amount);
    if (!person.trim() || !Number.isFinite(value) || value <= 0 || saving) {
      setError("Ism va musbat summa kiriting");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: person.trim(),
          amount: value,
          direction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      setPerson("");
      setAmount("");
      setDirection("borrowed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Qo&apos;lda qo&apos;shish</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="Ism (masalan, Aziz)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Summa (so'm)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="manual-direction"
            checked={direction === "borrowed"}
            onChange={() => setDirection("borrowed")}
          />
          Qarz oldim
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="manual-direction"
            checked={direction === "lent"}
            onChange={() => setDirection("lent")}
          />
          Qarz berdim
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <span className="text-xs text-gray-400">Tezkor kiritish ishlamasa</span>
        )}
        <button
          type="button"
          onClick={add}
          disabled={saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {saving ? "..." : "Qo'shish"}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Per-debt row (settle toggle + delete)
// ---------------------------------------------------------------------------

function DebtRow({ debt }: { debt: Debt }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleSettle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/debts/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debtId: debt.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/debts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debtId: debt.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span
        className={`text-sm font-medium ${
          debt.settled ? "text-gray-400 line-through" : "text-gray-900"
        }`}
      >
        {formatAmount(debt.amount)}
      </span>
      <span
        className={`text-xs ${
          debt.settled ? "text-gray-300 line-through" : "text-gray-500"
        }`}
      >
        {DIRECTION_LABEL[debt.direction]}
      </span>
      <span className="text-xs text-gray-400">{formatDate(debt.created_at)}</span>
      {debt.note && (
        <span className="text-xs text-gray-400">· {debt.note}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={toggleSettle}
          disabled={busy}
          className={`rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-60 ${
            debt.settled
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          {debt.settled ? "✓ Yopilgan" : "Yopildi"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label="O'chirish"
          className="rounded-md px-2 py-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60"
        >
          ✕
        </button>
      </div>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Grouped-by-person list
// ---------------------------------------------------------------------------

function PersonGroup({ person, debts }: { person: string; debts: Debt[] }) {
  // Net (unsettled only): lent counts positive (they owe you), borrowed
  // negative (you owe them).
  const net = debts.reduce((sum, d) => {
    if (d.settled) return sum;
    return sum + (d.direction === "lent" ? d.amount : -d.amount);
  }, 0);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate font-semibold text-gray-900">{person}</h3>
        <span
          className={`shrink-0 text-sm font-medium ${
            net > 0
              ? "text-emerald-600"
              : net < 0
                ? "text-red-600"
                : "text-gray-400"
          }`}
        >
          {net > 0 && `Sizga qarzdor: ${formatAmount(net)}`}
          {net < 0 && `Siz qarzdorsiz: ${formatAmount(-net)}`}
          {net === 0 && "Hisob teng"}
        </span>
      </div>
      <ul className="mt-2 divide-y divide-gray-100">
        {debts.map((d) => (
          <DebtRow key={d.id} debt={d} />
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function DebtsClient({ debts }: { debts: Debt[] }) {
  // Summary totals over unsettled debts.
  const owedToMe = debts
    .filter((d) => !d.settled && d.direction === "lent")
    .reduce((sum, d) => sum + d.amount, 0);
  const iOwe = debts
    .filter((d) => !d.settled && d.direction === "borrowed")
    .reduce((sum, d) => sum + d.amount, 0);

  // Group by person, preserving the created_at-desc order from the server.
  const groups: { person: string; debts: Debt[] }[] = [];
  const indexByPerson = new Map<string, number>();
  for (const d of debts) {
    const key = d.person.toLowerCase();
    let idx = indexByPerson.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByPerson.set(key, idx);
      groups.push({ person: d.person, debts: [] });
    }
    groups[idx].debts.push(d);
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Menga qarzdorlar</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {formatAmount(owedToMe)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Mening qarzlarim</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">
            {formatAmount(iOwe)}
          </p>
        </div>
      </div>

      <QuickDebt />
      <ManualDebt />

      {/* Grouped list */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-900">Hali qarz yo&apos;q</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <PersonGroup key={g.person} person={g.person} debts={g.debts} />
          ))}
        </div>
      )}
    </div>
  );
}
