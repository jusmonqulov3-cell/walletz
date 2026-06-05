"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/income", label: "Daromad" },
  { href: "/goals", label: "Maqsadlar" },
  { href: "/debts", label: "Qarzlar" },
  { href: "/chat", label: "AI Chat" },
  { href: "/telegram", label: "Telegram" },
];

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
            <nav className="flex items-center gap-1">
              {NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
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
        {variant === "scroll" ? (
          <div className="h-full overflow-y-auto">{children}</div>
        ) : (
          <div className="flex h-full flex-col">{children}</div>
        )}
      </main>
    </div>
  );
}
