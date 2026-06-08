import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format";
import { getTashkentPeriods } from "@/lib/dates";
import { CATEGORIES, categoryColor, type Category } from "@/lib/categories";
import AppShell from "@/components/AppShell";
import AvatarMenu from "@/components/AvatarMenu";
import { getDict } from "@/lib/i18n/server";
import { buildInsights } from "@/lib/insights";
import InsightsCard from "./InsightsCard";
import ExpenseInput from "./ExpenseInput";
import FinancialCoach from "./FinancialCoach";
import BudgetCard from "./BudgetCard";
import ExpenseSearch from "./ExpenseSearch";

type MonthRow = { amount: number; category: string | null; spent_at: string };
type RecentRow = {
  id: string;
  note: string | null;
  amount: number;
  category: string | null;
  spent_at: string;
};

// Compact display of a so'm amount → { v, u } (presentation only).
function compact(n: number): { v: string; u: string } {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return { v: m >= 10 ? m.toFixed(1) : m.toFixed(2), u: "mln" };
  }
  if (n >= 1_000) return { v: String(Math.round(n / 1_000)), u: "ming" };
  return { v: String(Math.round(n)), u: "so'm" };
}

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const UZ_DAYS = [
  "yakshanba", "dushanba", "seshanba", "chorshanba",
  "payshanba", "juma", "shanba",
];

function StatCard({ label, value }: { label: string; value: number }) {
  const { v, u } = compact(value);
  return (
    <div className="stat">
      <div className="lbl">{label}</div>
      <div className="val">
        <b className="mono">{v}</b>
        <span>{u}</span>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims) {
    redirect("/login");
  }

  const { startOfToday, startOfWeek, startOfMonth } = getTashkentPeriods();
  const todayMs = new Date(startOfToday).getTime();
  const weekMs = new Date(startOfWeek).getTime();

  const [monthRes, recentRes, budgetRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount, category, spent_at")
      .gte("spent_at", startOfMonth),
    supabase
      .from("expenses")
      .select("id, note, amount, category, spent_at")
      .order("spent_at", { ascending: false })
      .limit(50),
    supabase
      .from("budgets")
      .select("monthly_limit")
      .is("category", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const monthRows = (monthRes.data ?? []) as MonthRow[];
  const recent = (recentRes.data ?? []) as RecentRow[];
  const limit =
    budgetRes.data?.monthly_limit != null
      ? Number(budgetRes.data.monthly_limit)
      : null;

  // --- Totals (boundaries are UTC instants anchored to Asia/Tashkent) ---
  let todayTotal = 0;
  let weekTotal = 0;
  let monthTotal = 0;
  const byCategory = new Map<string, number>();

  for (const row of monthRows) {
    const amount = Number(row.amount) || 0;
    const ms = new Date(row.spent_at).getTime();
    monthTotal += amount;
    if (ms >= weekMs) weekTotal += amount;
    if (ms >= todayMs) todayTotal += amount;

    const cat: Category = (CATEGORIES as readonly string[]).includes(
      row.category ?? "",
    )
      ? (row.category as Category)
      : "Boshqa";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + amount);
  }

  const breakdown = [...byCategory.entries()]
    .filter(([, total]) => total > 0)
    .map(([category, total]) => ({
      category,
      total,
      percent: monthTotal > 0 ? Math.round((total / monthTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Donut geometry: cumulative arc segments over a circle (r=80, C≈502.65).
  const R = 80;
  const C = 2 * Math.PI * R;
  const fractions = breakdown.map((b) =>
    monthTotal > 0 ? b.total / monthTotal : 0,
  );
  const segments = breakdown.map((b, i) => ({
    color: categoryColor(b.category),
    dash: fractions[i] * C,
    // Offset = cumulative arc length of all preceding segments.
    offset: fractions.slice(0, i).reduce((sum, f) => sum + f, 0) * C,
  }));

  const totalCompact = compact(monthTotal);

  // Uzbek long date anchored to Tashkent (UTC+5).
  const tash = new Date(new Date(startOfToday).getTime() + 5 * 3600 * 1000);
  const dateLabel = `${tash.getUTCDate()}-${UZ_MONTHS[tash.getUTCMonth()]}, ${UZ_DAYS[tash.getUTCDay()]}`;
  const email =
    typeof auth.claims.email === "string" ? auth.claims.email : "";
  const name = email.split("@")[0] || "foydalanuvchi";
  const t = await getDict();

  const userId = typeof auth.claims.sub === "string" ? auth.claims.sub : "";
  const insights = await buildInsights(supabase, userId);
  const hasInsights =
    insights.forecast.thisMonthTotal > 0 ||
    insights.anomalies.length > 0 ||
    insights.recurring.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        {/* page header */}
        <div className="appbar">
          <div>
            <div className="date">{dateLabel}</div>
            <div className="greet">{t.dashboard.greet}, {name}</div>
          </div>
          <div className="actions">
            <Link className="icon-btn" href="/investments" aria-label="Investitsiya">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l5-5 3 3 7-7" />
                <path d="M14 8h5v5" />
              </svg>
            </Link>
            <AvatarMenu name={name} />
          </div>
        </div>

        {/* summary stats */}
        <div className="stat-grid">
          <StatCard label={t.dashboard.today} value={todayTotal} />
          <StatCard label={t.dashboard.week} value={weekTotal} />
          <StatCard label={t.dashboard.month} value={monthTotal} />
        </div>

        {/* budget */}
        <BudgetCard monthTotal={monthTotal} limit={limit} />

        {/* insights & forecast */}
        {hasInsights && <InsightsCard insights={insights} t={t} />}

        {/* category breakdown donut */}
        {breakdown.length > 0 && (
          <div className="section">
            <div className="card chart-card">
              <div className="ch-head">
                <h3>{t.dashboard.breakdown}</h3>
              </div>
              <div className="donut-wrap">
                <svg width="200" height="200" viewBox="0 0 200 200">
                  <circle
                    cx="100" cy="100" r={R} fill="none"
                    stroke="var(--track)" strokeWidth="26"
                  />
                  {segments.map((s, i) => (
                    <circle
                      key={i}
                      cx="100" cy="100" r={R} fill="none"
                      stroke={s.color} strokeWidth="26"
                      strokeDasharray={`${s.dash} ${C - s.dash}`}
                      strokeDashoffset={-s.offset}
                      transform="rotate(-90 100 100)"
                    />
                  ))}
                </svg>
                <div className="donut-center">
                  <div className="t-lbl">{t.dashboard.total}</div>
                  <div className="t-val mono">{totalCompact.v}</div>
                  <div className="t-unit">{totalCompact.u} {t.dashboard.som}</div>
                </div>
              </div>
              <div className="legend">
                {breakdown.map((c) => (
                  <div className="row" key={c.category}>
                    <span className="dot" style={{ background: categoryColor(c.category) }} />
                    <span className="nm">{c.category}</span>
                    <span className="pc">{c.percent}%</span>
                    <span className="am mono">{formatAmount(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* new entry (text / receipt / voice) */}
        <div className="section">
          <div className="section-head">
            <h2>{t.dashboard.newEntry}</h2>
          </div>
          <ExpenseInput />
        </div>

        {/* coach */}
        <div className="section">
          <div className="section-head">
            <h2>{t.dashboard.coach}</h2>
          </div>
          <FinancialCoach />
        </div>

        {/* search + recent */}
        <div className="section">
          <ExpenseSearch recent={recent} />
        </div>
      </div>
    </AppShell>
  );
}
