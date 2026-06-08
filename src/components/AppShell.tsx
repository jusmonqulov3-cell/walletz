"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import type { Dict } from "@/lib/i18n/dictionaries";

// Minimal line-icon set (stroke, currentColor) matching the design language.
const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
    </>
  ),
  income: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="13.5" r="1.2" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  debts: (
    <>
      <path d="M16 4l4 4-4 4" />
      <path d="M20 8H8" />
      <path d="M8 20l-4-4 4-4" />
      <path d="M4 16h12" />
    </>
  ),
  investments: (
    <>
      <path d="M3 17l5-5 3 3 7-7" />
      <path d="M14 8h5v5" />
    </>
  ),
};

const NAV: { href: string; key: keyof Dict["nav"]; icon: string }[] = [
  { href: "/dashboard", key: "dashboard", icon: "dashboard" },
  { href: "/income", key: "income", icon: "income" },
  { href: "/goals", key: "goals", icon: "goals" },
  { href: "/debts", key: "debts", icon: "debts" },
  { href: "/investments", key: "investments", icon: "investments" },
];

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({
  children,
  variant = "scroll",
}: {
  children: React.ReactNode;
  /** "scroll": normal document-style scrolling page. "fill": child manages its
   *  own full-height layout (e.g. the chat pane with a pinned input). */
  variant?: "scroll" | "fill";
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* No top bar — each page renders its own header (the .appbar), and the
          settings live in that header's avatar menu. Navigation is the bottom
          tab bar below, shown on every screen size. */}
      <main className="min-h-0 flex-1">
        {/* pb keeps content clear of the fixed bottom tab bar. */}
        {variant === "scroll" ? (
          <div className="h-full overflow-y-auto pb-24">{children}</div>
        ) : (
          <div className="flex h-full flex-col pb-20">{children}</div>
        )}
      </main>

      {/* Floating action button → AI chat. Sits above the bottom tab bar.
          Hidden while already on the chat screen. */}
      {!isActive(pathname, "/chat") && (
        <Link
          href="/chat"
          aria-label="AI Chat"
          title="AI Chat"
          className="fixed bottom-[88px] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgba(20,20,30,0.22)] ring-1 ring-black/5 transition-transform active:scale-95 sm:right-6"
        >
          <span className="bg-gradient-to-br from-[#6e76d6] to-[#8a7be0] bg-clip-text text-[15px] font-bold tracking-tight text-transparent">
            AI
          </span>
        </Link>
      )}

      {/* Fixed bottom tab bar (translucent) — the app's primary navigation on
          every screen size now that the top bar is gone. Centered on desktop. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-3xl items-start justify-around border-t border-border px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:border-x sm:rounded-t-2xl"
        style={{ background: "var(--glass)" }}
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 transition-colors ${
                active ? "text-accent" : "text-[var(--muted-2)] hover:text-muted"
              }`}
            >
              <span className="h-[22px] w-[22px]">
                <NavIcon name={item.icon} />
              </span>
              <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>
                {t.nav[item.key]}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
