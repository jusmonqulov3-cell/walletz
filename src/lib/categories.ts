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

// Display colors per category (presentation only) — harmonized with the
// design-system palette. Used by donut charts, legend dots, and chips.
export const CATEGORY_COLORS: Record<Category, string> = {
  "Oziq-ovqat": "#6B72C9",
  Transport: "#569A97",
  Uy: "#7C9CC9",
  Kommunal: "#C9924F",
  Kiyim: "#B97AA3",
  "Sog'liq": "#6E9D63",
  "O'yin-kulgi": "#8A7BE0",
  Boshqa: "#9AA0AC",
};

export function categoryColor(value: unknown): string {
  return CATEGORY_COLORS[toCategory(value)];
}
