import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format";
import { getTashkentMonthInfo } from "@/lib/dates";
import AppShell from "@/components/AppShell";
import { getDict } from "@/lib/i18n/server";
import QuickIncome from "./QuickIncome";
import IncomeList, { type IncomeRow } from "./IncomeList";

export default async function IncomePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims) {
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

  const t = await getDict();

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div>
            <div className="title">{t.income.title}</div>
            <div className="sub">{t.income.sub}</div>
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
            <IncomeList rows={recent} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
