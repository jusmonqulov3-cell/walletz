import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCryptoPrices, getUzsRates } from "@/lib/prices";
import AppShell from "@/components/AppShell";
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

// Asia/Tashkent is UTC+5 year-round (matches dates.ts / format.ts).
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

// Whole completed months between an ISO start and now, anchored to Tashkent —
// a deposit "completes" a month on each monthly anniversary of its start date.
function monthsElapsed(startIso: string, now: Date): number {
  const s = new Date(new Date(startIso).getTime() + TASHKENT_OFFSET_MS);
  const n = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  let m =
    (n.getUTCFullYear() - s.getUTCFullYear()) * 12 +
    (n.getUTCMonth() - s.getUTCMonth());
  if (n.getUTCDate() < s.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

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
        // Term deposit: principal (= quantity, in UZS) compounds monthly at
        // annualRate/12. Value = amount accrued so far; once the term ends the
        // accrual is capped (held at the maturity amount).
        unitPriceUZS = 1;
        const principal = quantity;
        const annualRate = interestRate ?? 0;
        const term = termMonths ?? 0;
        const monthlyRate = annualRate / 100 / 12;
        const elapsed = monthsElapsed(r.created_at, now);
        const effective = term > 0 ? Math.min(elapsed, term) : elapsed;
        const accrued = principal * Math.pow(1 + monthlyRate, effective);
        value = accrued;

        // Only treat it as a real deposit (with interest/timeline) when both a
        // term and a positive rate are set; otherwise it's plain savings.
        if (term > 0 && annualRate > 0) {
          profitLoss = accrued - principal;
          deposit = {
            annualRate,
            termMonths: term,
            monthsElapsed: Math.min(elapsed, term),
            monthsRemaining: Math.max(0, term - elapsed),
            matured: elapsed >= term,
            principal,
            maturityValue: principal * Math.pow(1 + monthlyRate, term),
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
      deposit,
    };
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div>
            <div className="title">Investitsiya</div>
            <div className="sub">Valyuta · kripto · aksiya · jamg&apos;arma</div>
          </div>
        </div>

        <InvestmentsClient holdings={holdings} />
      </div>
    </AppShell>
  );
}
