"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

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
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/dashboard"
              className="text-lg font-bold text-gray-900"
            >
              PulNazorat
            </Link>
            {/* Desktop: top horizontal nav. Hidden on mobile (bottom bar). */}
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition sm:px-3 ${
                      active
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Chiqish
            </button>
          </form>
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
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white sm:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-7">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  active
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-700"
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
