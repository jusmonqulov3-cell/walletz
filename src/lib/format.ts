// Renders an amount as "20 000 so'm" with a space thousands separator.
export function formatAmount(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  const grouped = rounded
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} so'm`;
}

// Renders an ISO timestamp as "05.06.2026" (deterministic, locale-free).
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
