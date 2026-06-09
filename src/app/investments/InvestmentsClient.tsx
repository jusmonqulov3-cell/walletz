"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/lib/format";

export type InvestmentType = "valyuta" | "kripto" | "aksiya" | "jamgarma";

// Server-computed deposit state for a jamgarma holding (null = plain savings).
// term fields are null for open-ended deposits.
export type DepositInfo = {
  annualRate: number;
  principal: number;
  earned: number;
  dailyEarn: number;
  monthlyEarn: number;
  termMonths: number | null;
  monthsElapsed: number;
  monthsRemaining: number | null;
  matured: boolean;
  maturityValue: number | null;
};

// A holding with server-computed live values folded in.
export type ComputedHolding = {
  id: string;
  type: InvestmentType;
  name: string;
  symbol: string | null;
  quantity: number;
  buy_price: number | null;
  manual_price: number | null;
  interestRate: number | null;
  termMonths: number | null;
  unitPriceUZS: number;
  value: number;
  priceMissing: boolean;
  profitLoss: number | null;
  deposit: DepositInfo | null;
};

const TYPE_META: Record<
  InvestmentType,
  { label: string; icon: string; color: string }
> = {
  valyuta: { label: "Valyuta", icon: "💵", color: "#2F9E68" },
  kripto: { label: "Kripto", icon: "₿", color: "#C9924F" },
  aksiya: { label: "Aksiya", icon: "📈", color: "#5E6AD2" },
  jamgarma: { label: "Jamg'arma", icon: "🏦", color: "#569A97" },
};

const TYPE_ORDER: InvestmentType[] = [
  "valyuta",
  "kripto",
  "aksiya",
  "jamgarma",
];

const CRYPTO_PRESETS: { label: string; name: string; id: string }[] = [
  { label: "Bitcoin", name: "Bitcoin", id: "bitcoin" },
  { label: "Ethereum", name: "Ethereum", id: "ethereum" },
  { label: "Oltin (Gold)", name: "Oltin", id: "pax-gold" },
];

// Renders a quantity without the " so'm" suffix (crypto can be fractional).
// Up to 8 decimals, no trailing zeros, never exponential notation. (Intl emits
// the minimal standard-notation form, so 1e-6 → "0.000001" and 10 stays "10".)
function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 8,
    useGrouping: false,
  });
}

// ---------------------------------------------------------------------------
// Per-row edit + delete
// ---------------------------------------------------------------------------

function HoldingRow({ holding }: { holding: ComputedHolding }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(holding.quantity));
  const [manualPrice, setManualPrice] = useState(
    holding.manual_price != null ? String(holding.manual_price) : "",
  );
  const [buyPrice, setBuyPrice] = useState(
    holding.buy_price != null ? String(holding.buy_price) : "",
  );
  const [annualRate, setAnnualRate] = useState(
    holding.interestRate != null ? String(holding.interestRate) : "",
  );
  const [termMonths, setTermMonths] = useState(
    holding.termMonths != null ? String(holding.termMonths) : "",
  );
  const [toppingUp, setToppingUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isJamgarma = holding.type === "jamgarma";
  const isAksiya = holding.type === "aksiya";
  const qtyLabel = isJamgarma ? "Summa (so'm)" : "Miqdor";

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const payload: Record<string, string | number> = { id: holding.id };
    const qty = Number(quantity);
    if (Number.isFinite(qty) && qty > 0) payload.quantity = qty;
    if (isAksiya && manualPrice) payload.manual_price = Number(manualPrice);
    if (!isJamgarma && buyPrice) payload.buy_price = Number(buyPrice);
    if (isJamgarma && annualRate !== "")
      payload.interest_rate = Number(annualRate);
    if (isJamgarma && termMonths !== "")
      payload.term_months = Number(termMonths);

    try {
      const res = await fetch("/api/investments/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function topUp() {
    if (busy) return;
    const amt = Number(topUpAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Summani kiriting");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/investments/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holding.id, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      setToppingUp(false);
      setTopUpAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/investments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holding.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
      setBusy(false);
    }
  }

  const color = TYPE_META[holding.type].color;

  return (
    <div className="border-t border-border px-[15px] py-3.5 first:border-t-0">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-[15px]"
          style={{ background: `${color}1f`, color }}
        >
          {TYPE_META[holding.type].icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-foreground">
            {holding.name}
            {holding.symbol && (
              <span className="ml-1 text-[12px] font-normal text-[var(--muted-2)]">
                {holding.symbol}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            {isJamgarma ? (
              holding.deposit ? (
                <>
                  <span className="mono">
                    {formatAmount(holding.deposit.principal)}
                  </span>{" "}
                  · yillik {holding.deposit.annualRate}%
                  {holding.deposit.termMonths != null && (
                    <>
                      {" · "}
                      {holding.deposit.matured
                        ? "muddat tugadi"
                        : `${holding.deposit.monthsElapsed}/${holding.deposit.termMonths} oy`}
                    </>
                  )}
                </>
              ) : (
                <span className="mono">{formatAmount(holding.quantity)}</span>
              )
            ) : (
              <>
                <span className="mono">{formatQty(holding.quantity)}</span> ×{" "}
                {holding.priceMissing ? (
                  "narx yo'q"
                ) : (
                  <span className="mono">{formatAmount(holding.unitPriceUZS)}</span>
                )}
              </>
            )}
          </div>
          {isJamgarma && holding.deposit && (
            <div className="mt-0.5 text-[11px] text-[var(--muted-2)]">
              {holding.deposit.matured ? (
                <>Muddat tugadi · foiz to&apos;xtadi</>
              ) : (
                <>
                  Kunlik{" "}
                  <span className="mono text-positive">
                    +{formatAmount(holding.deposit.dailyEarn)}
                  </span>{" "}
                  · Oylik{" "}
                  <span className="mono text-positive">
                    +{formatAmount(holding.deposit.monthlyEarn)}
                  </span>
                  {holding.deposit.monthsRemaining != null &&
                    ` · ${holding.deposit.monthsRemaining} oy qoldi`}
                </>
              )}
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-[14px] font-semibold text-foreground">
            {holding.priceMissing ? (
              <span className="text-[var(--muted-2)]">narx yo&apos;q</span>
            ) : (
              <span className="mono">{formatAmount(holding.value)}</span>
            )}
          </div>
          {holding.profitLoss != null && (
            <div
              className="mono text-[11.5px] font-medium"
              style={{
                color:
                  holding.profitLoss >= 0 ? "var(--positive)" : "var(--negative)",
              }}
            >
              {holding.profitLoss >= 0 ? "+" : "−"}
              {formatAmount(Math.abs(holding.profitLoss))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {isJamgarma && (
            <button
              type="button"
              onClick={() => setToppingUp((v) => !v)}
              aria-label="To'ldirish"
              title="To'ldirish (reinvest)"
              className="rounded-md px-1.5 py-1 text-muted transition hover:bg-[var(--subtle)] hover:text-foreground"
            >
              ＋
            </button>
          )}
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
      </div>

      {toppingUp && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[10px] bg-[var(--subtle)] p-3">
          <label className="text-[12px] text-muted">
            To&apos;ldirish summasi (so&apos;m)
            <input
              type="number"
              inputMode="numeric"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="input mono mt-1 block w-36"
              style={{ padding: "8px 11px" }}
            />
          </label>
          <button
            type="button"
            onClick={topUp}
            disabled={busy}
            className="btn"
            style={{ width: "auto", padding: "9px 14px" }}
          >
            {busy ? "..." : "Qo'shish"}
          </button>
          <p className="w-full text-[11px] text-[var(--muted-2)]">
            Hozirgi foiz balansga qo&apos;shiladi va to&apos;liq summadan davom
            etadi.
          </p>
        </div>
      )}

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[10px] bg-[var(--subtle)] p-3">
          <label className="text-[12px] text-muted">
            {qtyLabel}
            <input
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input mono mt-1 block w-28"
              style={{ padding: "8px 11px" }}
            />
          </label>

          {isAksiya && (
            <label className="text-[12px] text-muted">
              Joriy narx (so&apos;m)
              <input
                type="number"
                inputMode="numeric"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="input mono mt-1 block w-32"
                style={{ padding: "8px 11px" }}
              />
            </label>
          )}

          {!isJamgarma && (
            <label className="text-[12px] text-muted">
              Sotib olish narxi (so&apos;m)
              <input
                type="number"
                inputMode="numeric"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="input mono mt-1 block w-32"
                style={{ padding: "8px 11px" }}
              />
            </label>
          )}

          {isJamgarma && (
            <>
              <label className="text-[12px] text-muted">
                Yillik foiz (%)
                <input
                  type="number"
                  inputMode="decimal"
                  value={annualRate}
                  onChange={(e) => setAnnualRate(e.target.value)}
                  className="input mono mt-1 block w-28"
                  style={{ padding: "8px 11px" }}
                />
              </label>
              <label className="text-[12px] text-muted">
                Muddat (oy)
                <input
                  type="number"
                  inputMode="numeric"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  className="input mono mt-1 block w-24"
                  style={{ padding: "8px 11px" }}
                />
              </label>
            </>
          )}

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

      {error && <p className="mt-2 text-[11.5px] text-negative">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add form (type-adaptive fields)
// ---------------------------------------------------------------------------

function AddForm() {
  const router = useRouter();
  const [type, setType] = useState<InvestmentType>("valyuta");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [annualRate, setAnnualRate] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetFields() {
    setName("");
    setSymbol("");
    setQuantity("");
    setBuyPrice("");
    setManualPrice("");
    setAnnualRate("");
    setTermMonths("");
  }

  async function add() {
    if (saving) return;
    setError(null);

    // Assemble a type-specific payload.
    const payload: Record<string, string | number> = { type };
    const qty = Number(quantity);

    if (type === "valyuta") {
      const code = symbol.trim().toUpperCase();
      if (!code) return setError("Valyuta kodini kiriting (masalan, USD)");
      payload.name = code;
      payload.symbol = code;
    } else if (type === "kripto") {
      if (!name.trim() || !symbol.trim())
        return setError("Nom va CoinGecko id kiriting");
      payload.name = name.trim();
      payload.symbol = symbol.trim().toLowerCase();
    } else if (type === "aksiya") {
      if (!name.trim()) return setError("Nom kiriting");
      if (!Number(manualPrice))
        return setError("Joriy narxni kiriting (so'm)");
      payload.name = name.trim();
      payload.manual_price = Number(manualPrice);
    } else {
      // jamgarma: label + amount (amount IS the quantity in so'm), plus an
      // optional annual rate (%) and term (months) to make it a real deposit.
      if (!name.trim()) return setError("Nom kiriting");
      payload.name = name.trim();
      if (annualRate) payload.interest_rate = Number(annualRate);
      if (termMonths) payload.term_months = Number(termMonths);
    }

    if (!Number.isFinite(qty) || qty <= 0)
      return setError(
        type === "jamgarma" ? "Summani kiriting" : "Miqdorni kiriting",
      );
    payload.quantity = qty;
    if (type !== "jamgarma" && type !== "aksiya" && buyPrice)
      payload.buy_price = Number(buyPrice);

    setSaving(true);
    try {
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      resetFields();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "input";

  return (
    <div className="card card-pad">
      {/* Type selector */}
      <div className="seg mb-3 flex-wrap">
        {TYPE_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            className={type === t ? "active" : ""}
            onClick={() => {
              setType(t);
              setError(null);
            }}
          >
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      {/* Crypto quick presets */}
      {type === "kripto" && (
        <div className="chips mb-3">
          {CRYPTO_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              onClick={() => {
                setName(p.name);
                setSymbol(p.id);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Type-adaptive fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {type === "valyuta" && (
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Valyuta kodi (USD, EUR, RUB)"
            className={inputCls}
          />
        )}

        {type === "kripto" && (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom (Bitcoin)"
              className={inputCls}
            />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="CoinGecko id (bitcoin)"
              className={inputCls}
            />
          </>
        )}

        {type === "aksiya" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom (Apple, UzAuto)"
            className={inputCls}
          />
        )}

        {type === "jamgarma" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom (Bank depoziti)"
            className={inputCls}
          />
        )}

        <input
          type="number"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={
            type === "jamgarma" ? "Summa (so'm)" : "Miqdor"
          }
          className={inputCls}
        />

        {type === "aksiya" && (
          <input
            type="number"
            inputMode="numeric"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            placeholder="Joriy narx (so'm)"
            className={inputCls}
          />
        )}

        {(type === "valyuta" || type === "kripto") && (
          <input
            type="number"
            inputMode="numeric"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            placeholder="Sotib olish narxi — ixtiyoriy (so'm/birlik)"
            className={inputCls}
          />
        )}

        {type === "jamgarma" && (
          <>
            <input
              type="number"
              inputMode="decimal"
              value={annualRate}
              onChange={(e) => setAnnualRate(e.target.value)}
              placeholder="Yillik foiz % (masalan, 24)"
              className={inputCls}
            />
            <input
              type="number"
              inputMode="numeric"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              placeholder="Muddat — oy (ixtiyoriy)"
              className={inputCls}
            />
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {error ? (
          <p className="text-[12.5px] font-medium text-negative">{error}</p>
        ) : (
          <span className="text-[11.5px] text-muted">
            {type === "aksiya"
              ? "Narxni o'zingiz yangilab turasiz"
              : type === "jamgarma"
                ? "Summa so'mda · kunlik kapitalizatsiya · muddat ixtiyoriy"
                : "Narxlar avtomatik yangilanadi"}
          </span>
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

export default function InvestmentsClient({
  holdings,
}: {
  holdings: ComputedHolding[];
}) {
  const total = holdings.reduce((sum, h) => sum + h.value, 0);

  // Per-type totals for the breakdown, in display order.
  const byType = new Map<InvestmentType, number>();
  for (const h of holdings) {
    byType.set(h.type, (byType.get(h.type) ?? 0) + h.value);
  }

  // Aggregate P/L across holdings that have a buy price.
  const totalPL = holdings.reduce((s, h) => s + (h.profitLoss ?? 0), 0);
  const hasPL = holdings.some((h) => h.profitLoss != null);
  const plPct = total - totalPL > 0 ? (totalPL / (total - totalPL)) * 100 : 0;

  return (
    <div>
      {/* Portfolio value card */}
      <div className="card pf-card">
        <div className="h-lbl">Portfel qiymati</div>
        <div className="h-val mono">{formatAmount(total)}</div>
        {hasPL && (
          <div
            className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold"
            style={{ color: totalPL >= 0 ? "var(--positive)" : "var(--negative)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {totalPL >= 0 ? (
                <>
                  <path d="M7 17L17 7M17 7v9M17 7H8" />
                </>
              ) : (
                <path d="M7 7l10 10M17 17V8M17 17H8" />
              )}
            </svg>
            {totalPL >= 0 ? "+" : "−"}
            {formatAmount(Math.abs(totalPL))}
            <span className="font-medium text-muted">
              ({totalPL >= 0 ? "+" : ""}
              {plPct.toFixed(1)}%)
            </span>
          </div>
        )}
        {holdings.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {TYPE_ORDER.filter((t) => (byType.get(t) ?? 0) > 0).map((t) => (
              <span key={t} className="badge-pill">
                {TYPE_META[t].label}: {formatAmount(byType.get(t) ?? 0)}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-[var(--muted-2)]">
          Narxlar yangilanadi · manba: CBU + CoinGecko
        </p>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Qo&apos;shish</h2>
        </div>
        <AddForm />
      </div>

      {/* Holdings grouped by type */}
      <div className="section">
        {holdings.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="eic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17l5-5 3 3 7-7" />
                  <path d="M14 8h5v5" />
                </svg>
              </div>
              <div className="et">Hali investitsiya yo&apos;q</div>
              <div className="ex">Birinchi aktivingizni yuqoridan qo&apos;shing.</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {TYPE_ORDER.map((t) => {
              const group = holdings.filter((h) => h.type === t);
              if (group.length === 0) return null;
              return (
                <div key={t}>
                  <div className="section-head">
                    <h2>{TYPE_META[t].label}</h2>
                    <span className="mono text-[13px] text-muted">
                      {formatAmount(byType.get(t) ?? 0)}
                    </span>
                  </div>
                  <div className="card">
                    {group.map((h) => (
                      <HoldingRow key={h.id} holding={h} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
