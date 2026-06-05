"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "Asosiy", icon: "🏠" },
  { href: "/income", label: "Daromad", short: "Daromad", icon: "💰" },
  { href: "/goals", label: "Maqsadlar", short: "Maqsad", icon: "🎯" },
  { href: "/debts", label: "Qarzlar", short: "Qarz", icon: "🤝" },
  { href: "/investments", label: "Investitsiya", short: "Invest", icon: "📈" },
  { href: "/chat", label: "AI Chat", short: "Chat", icon: "💬" },
  { href: "/telegram", label: "Telegram", short: "TG", icon: "✈️" },
];

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
      <header className="shrink-0 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground"
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
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-border/60 text-foreground"
                        : "text-muted hover:bg-border/40 hover:text-foreground"
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
              <Button type="submit" variant="secondary" size="sm">
                Chiqish
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {/* pb on mobile keeps content clear of the fixed bottom tab bar. */}
        {variant === "scroll" ? (
          <div className="h-full overflow-y-auto pb-20 sm:pb-0">{children}</div>
        ) : (
          <div className="flex h-full flex-col pb-16 sm:pb-0">{children}</div>
        )}
      </main>

      {/* Mobile: fixed bottom tab bar. Hidden on sm and up. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface sm:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-7">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {item.icon}
                </span>
                {item.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
