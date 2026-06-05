import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount, formatDate } from "@/lib/format";
import { getTashkentMonthInfo } from "@/lib/dates";
import AppShell from "@/components/AppShell";
import QuickIncome from "./QuickIncome";

type IncomeRow = {
  id: string;
  source: string | null;
  amount: number;
  received_at: string;
};

export default async function IncomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { startOfMonth } = getTashkentMonthInfo();

  const [monthRes, recentRes] = await Promise.all([
    supabase.from("incomes").select("amount").gte("received_at", startOfMonth),
    supabase
      .from("incomes")
      .select("id, source, amount, received_at")
      .order("received_at", { ascending: false })
      .limit(50),
  ]);

  const monthTotal = (monthRes.data ?? []).reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0,
  );
  const recent = (recentRes.data ?? []) as IncomeRow[];

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div>
            <div className="title">Daromad</div>
            <div className="sub">Joriy oy · daromad manbalari</div>
          </div>
        </div>

        {/* This month income (accent hero) */}
        <div className="hero accent">
          <div className="h-lbl">Oylik daromad</div>
          <div className="h-val mono">{formatAmount(monthTotal)}</div>
        </div>

        {/* Quick input */}
        <div className="section">
          <div className="section-head">
            <h2>Yangi kirim</h2>
          </div>
          <QuickIncome />
        </div>

        {/* Recent incomes */}
        <section className="section">
          <div className="section-head">
            <h2>So&apos;nggi daromadlar</h2>
          </div>

          {recent.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="eic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 7l-5-5-5 5" />
                  </svg>
                </div>
                <div className="et">Hali daromad yo&apos;q</div>
                <div className="ex">Birinchi daromadingizni yuqoridan kiriting.</div>
              </div>
            </div>
          ) : (
            <div className="card list">
              {recent.map((r) => (
                <div className="li" key={r.id}>
                  <div className="badge" style={{ background: "var(--positive-weak)" }}>
                    <span style={{ background: "var(--positive)" }} />
                  </div>
                  <div className="meta">
                    <div className="m1 truncate">{r.source || "—"}</div>
                    <div className="m2">{formatDate(r.received_at)}</div>
                  </div>
                  <div className="right">
                    <div className="ramt pos mono">+{formatAmount(r.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
