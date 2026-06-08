import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  getDictionary,
  locales,
  type Dict,
  type Locale,
} from "./dictionaries";

export const LOCALE_COOKIE = "locale";

// Reads the active locale from the request cookie (Server Components only).
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return locales.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

// Convenience: the translation dictionary for the active locale.
export async function getDict(): Promise<Dict> {
  return getDictionary(await getLocale());
}
