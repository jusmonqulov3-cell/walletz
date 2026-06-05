// The 8 expense categories used across the app (matches the seeded defaults).
export const CATEGORIES = [
  "Oziq-ovqat",
  "Transport",
  "Uy",
  "Kommunal",
  "Kiyim",
  "Sog'liq",
  "O'yin-kulgi",
  "Boshqa",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_CATEGORY: Category = "Boshqa";

// Normalizes an arbitrary value to a known category, falling back to "Boshqa".
export function toCategory(value: unknown): Category {
  return (CATEGORIES as readonly string[]).includes(value as string)
    ? (value as Category)
    : DEFAULT_CATEGORY;
}
