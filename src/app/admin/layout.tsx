import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import AdminNav from "./AdminNav";

// Server layout for the admin area. Re-verifies admin access on EVERY request —
// the proxy gate is only an optimistic first line of defense.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-accent-foreground"
            >
              A
            </span>
            <div className="leading-tight">
              <div className="text-[14px] font-semibold text-foreground">
                Admin Panel
              </div>
              <div className="text-[11px] text-muted">{user?.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AdminNav />
            <Link
              href="/dashboard"
              className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-[var(--subtle)] hover:text-foreground"
            >
              ← Ilovaga qaytish
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
