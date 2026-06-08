"use server";

import { cookies } from "next/headers";
import { locales, type Locale } from "./dictionaries";
import { LOCALE_COOKIE } from "./server";

// Persists the chosen language in a year-long cookie. The client calls this and
// then refreshes so Server Components re-render in the new locale.
export async function setLocale(locale: Locale): Promise<void> {
  if (!locales.includes(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
