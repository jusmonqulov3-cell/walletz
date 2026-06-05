// Renders an amount as "20 000 so'm" with a space thousands separator.
export function formatAmount(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  const grouped = rounded
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} so'm`;
}

// Asia/Tashkent is a fixed UTC+5 offset year-round (matches dates.ts).
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

// Renders an ISO timestamp as "05.06.2026" anchored to Asia/Tashkent, so
// server-rendered dates (UTC runtime) match the Tashkent calendar day. Shifting
// by the offset and reading getUTC* yields Tashkent wall-clock components.
export function formatDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + TASHKENT_OFFSET_MS);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
