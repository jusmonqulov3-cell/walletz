import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCryptoPrices, getUzsRates } from "@/lib/prices";
import { computeJamgarma } from "@/lib/jamgarma";
import AppShell from "@/components/AppShell";
import { getDict } from "@/lib/i18n/server";
import InvestmentsClient, {
  type ComputedHolding,
  type InvestmentType,
} from "./InvestmentsClient";

type InvestmentRow = {
  id: string;
  type: InvestmentType;
  name: string;
  symbol: string | null;
  quantity: number;
  buy_price: number | null;
  manual_price: number | null;
  interest_rate: number | null;
  term_months: number | null;
  created_at: string;
};

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("investments")
    .select(
      "id, type, name, symbol, quantity, buy_price, manual_price, interest_rate, term_months, created_at",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as InvestmentRow[];

  // Collect the symbols/codes we need live prices for.
  const cryptoIds = [
    ...new Set(
      rows
        .filter((r) => r.type === "kripto" && r.symbol)
        .map((r) => r.symbol!.toLowerCase()),
    ),
  ];

  const [cryptoUsd, uzsRates] = await Promise.all([
    getCryptoPrices(cryptoIds),
    getUzsRates(),
  ]);
  const usdToUzs = uzsRates["USD"] || 0;

  const now = new Date();

  const holdings: ComputedHolding[] = rows.map((r) => {
    const quantity = Number(r.quantity);
    const buyPrice = r.buy_price != null ? Number(r.buy_price) : null;
    const manualPrice = r.manual_price != null ? Number(r.manual_price) : null;
    const interestRate = r.interest_rate != null ? Number(r.interest_rate) : null;
    const termMonths = r.term_months != null ? Number(r.term_months) : null;

    let unitPriceUZS = 0;
    let priceMissing = false;
    let value = 0;
    let profitLoss: number | null = null;
    let deposit: ComputedHolding["deposit"] = null;

    switch (r.type) {
      case "valyuta": {
        const rate = r.symbol ? uzsRates[r.symbol.toUpperCase()] : 0;
        if (rate && rate > 0) unitPriceUZS = rate;
        else priceMissing = true;
        value = priceMissing ? 0 : quantity * unitPriceUZS;
        profitLoss =
          buyPrice != null && !priceMissing
            ? (unitPriceUZS - buyPrice) * quantity
            : null;
        break;
      }
      case "kripto": {
        const usd = r.symbol ? cryptoUsd[r.symbol.toLowerCase()] : 0;
        if (usd && usd > 0 && usdToUzs > 0) unitPriceUZS = usd * usdToUzs;
        else priceMissing = true;
        value = priceMissing ? 0 : quantity * unitPriceUZS;
        profitLoss =
          buyPrice != null && !priceMissing
            ? (unitPriceUZS - buyPrice) * quantity
            : null;
        break;
      }
      case "aksiya": {
        if (manualPrice && manualPrice > 0) unitPriceUZS = manualPrice;
        else priceMissing = true;
        value = priceMissing ? 0 : quantity * unitPriceUZS;
        profitLoss =
          buyPrice != null && !priceMissing
            ? (unitPriceUZS - buyPrice) * quantity
            : null;
        break;
      }
      case "jamgarma": {
        // Savings deposit: principal (= quantity, in UZS) compounds DAILY at
        // annualRate/365 from created_at (the accrual anchor). Value = balance
        // accrued so far. term_months is optional — open-ended when null, and
        // capped at the maturity amount once a set term ends. See lib/jamgarma.
        unitPriceUZS = 1;
        const principal = quantity;
        const annualRate = interestRate ?? 0;
        const j = computeJamgarma(principal, annualRate, termMonths, r.created_at, now);
        value = j.accrued;

        // Only treat it as an interest-bearing deposit when a positive rate is
        // set; otherwise it's plain savings (no timeline, no earnings shown).
        if (annualRate > 0) {
          profitLoss = j.earned;
          deposit = {
            annualRate: j.annualRate,
            principal: j.principal,
            earned: j.earned,
            dailyEarn: j.dailyEarn,
            monthlyEarn: j.monthlyEarn,
            termMonths: j.termMonths,
            monthsElapsed: j.monthsElapsed,
            monthsRemaining: j.monthsRemaining,
            matured: j.matured,
            maturityValue: j.maturityValue,
          };
        }
        break;
      }
    }

    return {
      id: r.id,
      type: r.type,
      name: r.name,
      symbol: r.symbol,
      quantity,
      buy_price: buyPrice,
      manual_price: manualPrice,
      unitPriceUZS,
      value,
      priceMissing,
      profitLoss,
      interestRate,
      termMonths,
      createdAt: r.created_at,
      deposit,
    };
  });

  const t = await getDict();

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div>
            <div className="title">{t.investments.title}</div>
            <div className="sub">{t.investments.sub}</div>
          </div>
        </div>

        <InvestmentsClient holdings={holdings} />
      </div>
    </AppShell>
  );
}
