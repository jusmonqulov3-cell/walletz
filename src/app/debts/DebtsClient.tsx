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
    <div className="inline-flex overflow-hidden rounded-[10px] border border-border">
      {(["borrowed", "lent"] as Direction[]).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className="px-3 py-1.5 text-[12.5px] font-medium transition-colors"
          style={
            value === d
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--card)", color: "var(--muted)" }
          }
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
    <div className="card card-pad">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Masalan: Azizdan 500 ming oldim"
          className="input resize-none"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11.5px] text-muted">
            Enter — tahlil, Shift+Enter — yangi qator
          </p>
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="btn"
            style={{ width: "auto", padding: "10px 16px" }}
          >
            {parsing ? "Tahlil qilinmoqda..." : "Qo'shish"}
          </button>
        </div>
        {parseError && (
          <p className="mt-3 text-[12.5px] font-medium text-negative">
            {parseError}
          </p>
        )}
      </div>

      {preview && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="field-label" style={{ margin: "0 0 9px" }}>
            Tasdiqlang
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border p-2">
            <input
              value={preview.person}
              onChange={(e) =>
                setPreview({ ...preview, person: e.target.value })
              }
              placeholder="Ism"
              className="input min-w-0 flex-1"
              style={{ padding: "8px 11px" }}
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={preview.amount}
              onChange={(e) =>
                setPreview({ ...preview, amount: Number(e.target.value) || 0 })
              }
              className="input mono w-32 text-right"
              style={{ padding: "8px 11px" }}
            />
            <DirectionToggle
              value={preview.direction}
              onChange={(direction) => setPreview({ ...preview, direction })}
            />
          </div>

          {saveError && (
            <p className="mt-3 text-[12.5px] font-medium text-negative">
              {saveError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn"
              style={{ width: "auto", padding: "10px 16px" }}
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      )}
    </div>
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
    <div className="card card-pad">
      <div className="field-label" style={{ margin: "0 0 11px" }}>
        Qo&apos;lda qo&apos;shish
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="Ism (masalan, Aziz)"
          className="input"
        />
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Summa (so'm)"
          className="input mono"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input
            type="radio"
            name="manual-direction"
            checked={direction === "borrowed"}
            onChange={() => setDirection("borrowed")}
          />
          Qarz oldim
        </label>
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input
            type="radio"
            name="manual-direction"
            checked={direction === "lent"}
            onChange={() => setDirection("lent")}
          />
          Qarz berdim
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {error ? (
          <p className="text-[12.5px] font-medium text-negative">{error}</p>
        ) : (
          <span className="text-[11.5px] text-muted">Tezkor kiritish ishlamasa</span>
        )}
        <button
          type="button"
          onClick={add}
          disabled={saving}
          className="btn"
          style={{ width: "auto", padding: "10px 16px" }}
        >
          {saving ? "..." : "Qo'shish"}
        </button>
      </div>
    </div>
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
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2.5 first:border-t-0">
      <span
        className={`mono text-[13.5px] font-semibold ${
          debt.settled ? "text-muted line-through" : "text-foreground"
        }`}
      >
        {formatAmount(debt.amount)}
      </span>
      <span
        className={`text-[12px] ${
          debt.settled ? "text-[var(--muted-2)] line-through" : "text-muted"
        }`}
      >
        {DIRECTION_LABEL[debt.direction]}
      </span>
      <span className="text-[11px] text-[var(--muted-2)]">
        {formatDate(debt.created_at)}
      </span>
      {debt.note && (
        <span className="text-[11px] text-[var(--muted-2)]">· {debt.note}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={toggleSettle}
          disabled={busy}
          className="rounded-md px-2 py-1 text-[11.5px] font-medium transition disabled:opacity-60"
          style={
            debt.settled
              ? { background: "var(--positive-weak)", color: "var(--positive)" }
              : { border: "1px solid var(--border)", color: "var(--muted)" }
          }
        >
          {debt.settled ? "✓ Yopilgan" : "Yopildi"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label="O'chirish"
          className="rounded-md px-2 py-1 text-muted transition hover:bg-[var(--subtle)] hover:text-foreground disabled:opacity-60"
        >
          ✕
        </button>
      </div>

      {error && <p className="w-full text-[11.5px] text-negative">{error}</p>}
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
    <div className="card card-pad">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-[14px] font-semibold text-foreground">
          {person}
        </h3>
        <span
          className="shrink-0 text-[12.5px] font-semibold"
          style={{
            color:
              net > 0
                ? "var(--positive)"
                : net < 0
                  ? "var(--negative)"
                  : "var(--muted)",
          }}
        >
          {net > 0 && `Sizga qarzdor: ${formatAmount(net)}`}
          {net < 0 && `Siz qarzdorsiz: ${formatAmount(-net)}`}
          {net === 0 && "Hisob teng"}
        </span>
      </div>
      <ul className="mt-1">
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

  const net = owedToMe - iOwe;

  return (
    <div>
      {/* Net balance hero */}
      <div className="hero">
        <div className="h-lbl">Sof balans</div>
        <div
          className="h-val mono"
          style={{ color: net >= 0 ? "var(--positive)" : "var(--negative)" }}
        >
          {net >= 0 ? "+" : "−"}
          {formatAmount(Math.abs(net))}
        </div>
        <div className="h-meta">
          <span>
            {net > 0
              ? "Sizga ko'proq qarzdor"
              : net < 0
                ? "Siz ko'proq qarzdorsiz"
                : "Hisob teng"}
          </span>
        </div>
      </div>

      {/* Balance cards */}
      <div className="balcards">
        <div className="balc">
          <div className="l">
            <span className="d" style={{ background: "var(--positive)" }} />
            Menga qarzdor
          </div>
          <div className="v mono" style={{ color: "var(--positive)" }}>
            +{formatAmount(owedToMe)}
          </div>
        </div>
        <div className="balc">
          <div className="l">
            <span className="d" style={{ background: "var(--negative)" }} />
            Men qarzdorman
          </div>
          <div className="v mono" style={{ color: "var(--negative)" }}>
            −{formatAmount(iOwe)}
          </div>
        </div>
      </div>

      <div className="section">
        <QuickDebt />
      </div>
      <div className="section">
        <ManualDebt />
      </div>

      {/* Grouped list */}
      <div className="section">
        {groups.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="eic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4l4 4-4 4M20 8H8M8 20l-4-4 4-4M4 16h12" />
                </svg>
              </div>
              <div className="et">Hali qarz yo&apos;q</div>
              <div className="ex">Qarz olgan yoki bergan summangizni qo&apos;shing.</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <PersonGroup key={g.person} person={g.person} debts={g.debts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
