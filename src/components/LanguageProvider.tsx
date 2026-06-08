"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  dictionaries,
  getDictionary,
  type Dict,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { setLocale as persistLocale } from "@/lib/i18n/actions";

type I18nContextValue = {
  locale: Locale;
  t: Dict;
  setLocale: (locale: Locale) => void;
  pending: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

// Receives the server-resolved locale as a prop and exposes it (plus the
// matching dictionary and a setter) to Client Components. The dictionary is
// looked up from the imported module here on the client, so translation
// functions survive — they are never serialized across the server boundary.
export default function LanguageProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setLocale = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      await persistLocale(next);
      router.refresh();
    });
  };

  return (
    <I18nContext.Provider
      value={{ locale, t: getDictionary(locale), setLocale, pending }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Defensive fallback so a stray client component never crashes the tree.
    return {
      locale: "uz",
      t: dictionaries.uz,
      setLocale: () => {},
      pending: false,
    };
  }
  return ctx;
}
