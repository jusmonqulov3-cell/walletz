"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { signOut } from "@/app/auth/actions";
import { useI18n } from "@/components/LanguageProvider";
import { LANGUAGE_NAMES, locales } from "@/lib/i18n/dictionaries";

// The circular initials avatar in the page header doubles as the settings
// menu: tapping it opens a dropdown with Telegram linking, language, theme
// switch, and sign-out — the controls that used to live in the removed top bar.
export default function AvatarMenu({
  name,
  isAdmin = false,
}: {
  name: string;
  isAdmin?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const { locale, t, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isDark = resolvedTheme === "dark";
  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--subtle)]";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="avatar"
        aria-label={t.menu.settings}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {name.slice(0, 2).toUpperCase()}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[46px] z-40 w-52 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-[0_8px_28px_rgba(20,20,30,0.16)]"
        >
          {isAdmin && (
            <>
              <Link
                role="menuitem"
                href="/admin"
                onClick={() => setOpen(false)}
                className={`${itemClass} font-semibold text-accent`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 3l8 4v5c0 4.4-3.4 7.7-8 9-4.6-1.3-8-4.6-8-9V7z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                Admin Panel
              </Link>
              <div className="my-1 h-px bg-border" />
            </>
          )}

          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            {t.menu.profile}
          </Link>

          <Link
            role="menuitem"
            href="/telegram"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21.5 4.5 2.5 11.8l5.3 1.9 1.9 6 2.8-3.6 4.9 3.6z" />
              <path d="m7.8 13.7 9.2-6.4-6.1 7.3" />
            </svg>
            {t.menu.telegram}
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={itemClass}
          >
            {isDark ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            {isDark ? t.menu.lightMode : t.menu.darkMode}
          </button>

          <div className="my-1 h-px bg-border" />

          {/* Language picker */}
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {t.menu.language}
          </div>
          {locales.map((lng) => {
            const active = lng === locale;
            return (
              <button
                key={lng}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLocale(lng);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors hover:bg-[var(--subtle)] ${
                  active ? "font-semibold text-accent" : "font-medium text-foreground"
                }`}
              >
                {LANGUAGE_NAMES[lng]}
                {active && (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}

          <div className="my-1 h-px bg-border" />

          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[var(--danger,#dc2626)] transition-colors hover:bg-[var(--subtle)]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              {t.menu.logout}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
