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
};

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("investments")
    .select("id, type, name, symbol, quantity, buy_price, manual_price")
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

  const holdings: ComputedHolding[] = rows.map((r) => {
    const quantity = Number(r.quantity);
    const buyPrice = r.buy_price != null ? Number(r.buy_price) : null;
    const manualPrice = r.manual_price != null ? Number(r.manual_price) : null;

    let unitPriceUZS = 0;
    let priceMissing = false;

    switch (r.type) {
      case "valyuta": {
        const rate = r.symbol ? uzsRates[r.symbol.toUpperCase()] : 0;
        if (rate && rate > 0) unitPriceUZS = rate;
        else priceMissing = true;
        break;
      }
      case "kripto": {
        const usd = r.symbol ? cryptoUsd[r.symbol.toLowerCase()] : 0;
        if (usd && usd > 0 && usdToUzs > 0) unitPriceUZS = usd * usdToUzs;
        else priceMissing = true;
        break;
      }
      case "aksiya": {
        if (manualPrice && manualPrice > 0) unitPriceUZS = manualPrice;
        else priceMissing = true;
        break;
      }
      case "jamgarma": {
        // quantity IS the UZS amount; unit price is 1.
        unitPriceUZS = 1;
        break;
      }
    }

    const value = priceMissing ? 0 : quantity * unitPriceUZS;
    const profitLoss =
      buyPrice != null && !priceMissing
        ? (unitPriceUZS - buyPrice) * quantity
        : null;

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
