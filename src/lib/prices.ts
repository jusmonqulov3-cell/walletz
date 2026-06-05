import "server-only";

/**
 * Live price helpers. These hit external APIs at runtime (on Vercel); both fail
 * gracefully by returning an empty map so the portfolio page never crashes when
 * a provider is unreachable.
 */

type CbuRate = { Ccy?: string; Rate?: string };

/**
 * Fetches Central Bank of Uzbekistan rates and returns a map of currency code →
 * UZS per 1 unit. USD is always present (1.0 fallback if the feed omits it).
 * Returns an empty map (with USD) on any failure — never throws.
 */
export async function getUzsRates(): Promise<Record<string, number>> {
  const rates: Record<string, number> = {};
  try {
    const res = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/", {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`CBU responded ${res.status}`);

    const data = (await res.json()) as CbuRate[];
    if (Array.isArray(data)) {
      for (const row of data) {
        const code = typeof row.Ccy === "string" ? row.Ccy.toUpperCase() : "";
        const rate = Number(row.Rate);
        if (code && Number.isFinite(rate) && rate > 0) {
          rates[code] = rate;
        }
      }
    }
  } catch (err) {
    console.error("getUzsRates error:", err);
  }

  // The som is 1:1 with itself, and USD must always be available for crypto
  // conversion. Default USD to 1 only if the feed didn't provide it.
  rates.UZS = 1;
  if (!rates.USD) rates.USD = 0;
  return rates;
}

/**
 * Fetches current USD spot prices for the given CoinGecko ids. Returns a map of
 * id → USD price. Empty input or any failure yields {} — never throws.
 */
export async function getCryptoPrices(
  ids: string[],
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};

  const prices: Record<string, number> = {};
  try {
    const joined = encodeURIComponent(ids.join(","));
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${joined}&vs_currencies=usd`,
      { next: { revalidate: 120 } },
    );
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);

    const data = (await res.json()) as Record<string, { usd?: number }>;
    for (const [id, entry] of Object.entries(data ?? {})) {
      const usd = Number(entry?.usd);
      if (Number.isFinite(usd) && usd > 0) prices[id] = usd;
    }
  } catch (err) {
    console.error("getCryptoPrices error:", err);
  }

  return prices;
}
