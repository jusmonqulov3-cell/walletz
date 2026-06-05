"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/lib/format";

export type InvestmentType = "valyuta" | "kripto" | "aksiya" | "jamgarma";

// A holding with server-computed live values folded in.
export type ComputedHolding = {
  id: string;
  type: InvestmentType;
  name: string;
  symbol: string | null;
  quantity: number;
  buy_price: number | null;
  manual_price: number | null;
  unitPriceUZS: number;
  value: number;
  priceMissing: boolean;
  profitLoss: number | null;
};

const TYPE_META: Record<InvestmentType, { label: string; icon: string }> = {
  valyuta: { label: "Valyuta", icon: "💵" },
  kripto: { label: "Kripto", icon: "₿" },
  aksiya: { label: "Aksiya", icon: "📈" },
  jamgarma: { label: "Jamg'arma", icon: "🏦" },
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
function formatQty(n: number): string {
  return String(n);
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

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {holding.name}
            {holding.symbol && (
              <span className="ml-1 text-xs font-normal text-gray-400">
                {holding.symbol}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {isJamgarma ? (
              <>{formatAmount(holding.quantity)}</>
            ) : (
              <>
                {formatQty(holding.quantity)} ×{" "}
                {holding.priceMissing
                  ? "narx yo'q"
                  : formatAmount(holding.unitPriceUZS)}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {holding.priceMissing ? (
                <span className="text-gray-400">narx yo&apos;q</span>
              ) : (
                formatAmount(holding.value)
              )}
            </p>
            {holding.profitLoss != null && (
              <p
                className={`text-xs font-medium ${
                  holding.profitLoss >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {holding.profitLoss >= 0 ? "+" : "−"}
                {formatAmount(Math.abs(holding.profitLoss))}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-label="Tahrirlash"
              className="rounded-md px-2 py-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              ✎
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
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
          <label className="text-xs text-gray-500">
            {qtyLabel}
            <input
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 block w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          {isAksiya && (
            <label className="text-xs text-gray-500">
              Joriy narx (so&apos;m)
              <input
                type="number"
                inputMode="numeric"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="mt-1 block w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>
          )}

          {!isJamgarma && (
            <label className="text-xs text-gray-500">
              Sotib olish narxi (so&apos;m)
              <input
                type="number"
                inputMode="numeric"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="mt-1 block w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>
          )}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {busy ? "..." : "Saqlash"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetFields() {
    setName("");
    setSymbol("");
    setQuantity("");
    setBuyPrice("");
    setManualPrice("");
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
      // jamgarma: label + amount (amount IS the quantity in so'm)
      if (!name.trim()) return setError("Nom kiriting");
      payload.name = name.trim();
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

  const inputCls =
    "rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-gray-700">Qo&apos;shish</h2>

      {/* Type selector */}
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {TYPE_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              setError(null);
            }}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:text-sm ${
              type === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {TYPE_META[t].icon} {TYPE_META[t].label}
          </button>
        ))}
      </div>

      {/* Crypto quick presets */}
      {type === "kripto" && (
        <div className="mb-3 flex flex-wrap gap-2">
          {CRYPTO_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setName(p.name);
                setSymbol(p.id);
              }}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
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
      </div>

      <div className="mt-3 flex items-center justify-between">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <span className="text-xs text-gray-400">
            {type === "aksiya"
              ? "Narxni o'zingiz yangilab turasiz"
              : type === "jamgarma"
                ? "Summa so'mda"
                : "Narxlar avtomatik yangilanadi"}
          </span>
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

  return (
    <div className="space-y-6">
      {/* Total + breakdown */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Umumiy qiymat</p>
        <p className="mt-1 text-3xl font-semibold text-gray-900">
          {formatAmount(total)}
        </p>
        {holdings.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {TYPE_ORDER.filter((t) => (byType.get(t) ?? 0) > 0).map((t) => (
              <span
                key={t}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
              >
                {TYPE_META[t].icon} {TYPE_META[t].label}:{" "}
                {formatAmount(byType.get(t) ?? 0)}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Narxlar yangilanadi · manba: CBU + CoinGecko
        </p>
      </section>

      <AddForm />

      {/* Holdings grouped by type */}
      {holdings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-900">
            Hali investitsiya yo&apos;q
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.map((t) => {
            const group = holdings.filter((h) => h.type === t);
            if (group.length === 0) return null;
            return (
              <section
                key={t}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-gray-900">
                    {TYPE_META[t].icon} {TYPE_META[t].label}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {formatAmount(byType.get(t) ?? 0)}
                  </span>
                </div>
                <ul className="mt-1 divide-y divide-gray-100">
                  {group.map((h) => (
                    <HoldingRow key={h.id} holding={h} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
