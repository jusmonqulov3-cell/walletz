"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import ThemeToggle from "@/components/ThemeToggle";

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

const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "Asosiy", icon: "dashboard" },
  { href: "/income", label: "Daromad", short: "Daromad", icon: "income" },
  { href: "/goals", label: "Maqsadlar", short: "Maqsad", icon: "goals" },
  { href: "/debts", label: "Qarzlar", short: "Qarz", icon: "debts" },
  { href: "/investments", label: "Investitsiya", short: "Invest", icon: "investments" },
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground"
            >
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-foreground"
              >
                P
              </span>
              PulNazorat
            </Link>
            {/* Desktop: top horizontal nav. Hidden on mobile (bottom bar). */}
            <nav className="hidden items-center gap-0.5 sm:flex">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-[var(--accent-weak)] text-accent"
                        : "text-muted hover:bg-[var(--subtle)] hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-[10px] border border-border bg-surface px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--subtle)]"
              >
                Chiqish
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {/* pb on mobile keeps content clear of the fixed bottom tab bar. */}
        {variant === "scroll" ? (
          <div className="h-full overflow-y-auto pb-24 sm:pb-0">{children}</div>
        ) : (
          <div className="flex h-full flex-col pb-20 sm:pb-0">{children}</div>
        )}
      </main>

      {/* Floating action button → AI chat. Sits above the mobile tab bar,
          bottom-right on desktop. Hidden while already on the chat screen. */}
      {!isActive(pathname, "/chat") && (
        <Link
          href="/chat"
          aria-label="AI Chat"
          title="AI Chat"
          className="fixed bottom-[88px] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgba(20,20,30,0.22)] ring-1 ring-black/5 transition-transform active:scale-95 sm:bottom-6 sm:right-6"
        >
          <span className="bg-gradient-to-br from-[#6e76d6] to-[#8a7be0] bg-clip-text text-[15px] font-bold tracking-tight text-transparent">
            AI
          </span>
        </Link>
      )}

      {/* Mobile: fixed bottom tab bar (translucent). Hidden on sm and up. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex items-start justify-around border-t border-border px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden"
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
                {item.short}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
