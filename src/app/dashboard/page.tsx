import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format";
import { getTashkentPeriods } from "@/lib/dates";
import { CATEGORIES, type Category } from "@/lib/categories";
import AppShell from "@/components/AppShell";
import QuickExpense from "./QuickExpense";
import ReceiptScanner from "./ReceiptScanner";
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">
        {formatAmount(value)}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900">
          Salom, {user.email}
        </h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Bugun" value={todayTotal} />
          <StatCard label="Bu hafta" value={weekTotal} />
          <StatCard label="Bu oy" value={monthTotal} />
          <BudgetCard monthTotal={monthTotal} limit={limit} />
        </div>

        {/* Quick input */}
        <QuickExpense />

        {/* Receipt-photo scanner */}
        <ReceiptScanner />

        {/* Category breakdown */}
        {breakdown.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-gray-700">
              Kategoriyalar bo&apos;yicha
            </h2>
            <ul className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
              {breakdown.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">
                      {c.category}
                    </span>
                    <span className="text-gray-500">
                      {formatAmount(c.total)} · {c.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gray-900"
                      style={{ width: `${c.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Search + recent expenses */}
        <ExpenseSearch recent={recent} />
      </div>
    </AppShell>
  );
}
