import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { formatAmount } from "@/lib/format";
import { getTashkentPeriods } from "@/lib/dates";
import {
  listAllUsers,
  fetchExpenseRows,
  sumColumn,
  countRows,
  countTelegramUsers,
  activeUserCounts,
} from "@/lib/admin-data";
import ExpensesChart, { type ChartPoint } from "./ExpensesChart";

const DAY_MS = 24 * 60 * 60 * 1000;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

// Tashkent (UTC+5) calendar day key, e.g. "2026-06-09".
function tashkentDayKey(ms: number): string {
  const t = new Date(ms + TASHKENT_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="mono mt-1 text-[20px] font-semibold text-foreground">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11.5px] text-[var(--muted-2)]">{sub}</div>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  // Independent admin check — never trust the proxy gate alone.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user)) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { startOfToday } = getTashkentPeriods();
  const todayMs = new Date(startOfToday).getTime();
  const since14Ms = todayMs - 13 * DAY_MS; // 14-day window incl. today
  const since14Iso = new Date(since14Ms).toISOString();

  const [
    users,
    expenseAgg,
    incomeAgg,
    goalsCount,
    debtsCount,
    investmentsCount,
    telegramUsers,
    recentExpenses,
  ] = await Promise.all([
    listAllUsers(admin),
    sumColumn(admin, "expenses"),
    sumColumn(admin, "incomes"),
    countRows(admin, "goals"),
    countRows(admin, "debts"),
    countRows(admin, "investments"),
    countTelegramUsers(admin),
    fetchExpenseRows(admin, since14Iso),
  ]);

  const { active7, active30 } = activeUserCounts(users);

  // Bucket the last 14 days of expenses by Tashkent calendar day.
  const buckets = new Map<string, number>();
  for (const row of recentExpenses) {
    const key = tashkentDayKey(new Date(row.spent_at).getTime());
    buckets.set(key, (buckets.get(key) ?? 0) + (Number(row.amount) || 0));
  }
  const chartData: ChartPoint[] = Array.from({ length: 14 }, (_, i) => {
    const ms = since14Ms + i * DAY_MS;
    const key = tashkentDayKey(ms);
    const [y, m, d] = key.split("-");
    return {
      label: d,
      full: `${d}.${m}.${y}`,
      total: buckets.get(key) ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[18px] font-semibold text-foreground">Umumiy</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Barcha foydalanuvchilar bo&apos;yicha jami ko&apos;rsatkichlar
        </p>
      </div>

      {/* Users */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Jami foydalanuvchilar" value={String(users.length)} />
        <StatCard
          label="Faol (7 kun)"
          value={String(active7)}
          sub="oxirgi kirish bo'yicha"
        />
        <StatCard
          label="Faol (30 kun)"
          value={String(active30)}
          sub="oxirgi kirish bo'yicha"
        />
        <StatCard
          label="Telegram ulangan"
          value={String(telegramUsers)}
          sub="foydalanuvchilar"
        />
        <StatCard label="Maqsadlar" value={String(goalsCount)} />
        <StatCard label="Qarzlar" value={String(debtsCount)} />
        <StatCard label="Investitsiyalar" value={String(investmentsCount)} />
        <StatCard
          label="Jami xarajatlar"
          value={formatAmount(expenseAgg.sum)}
          sub={`${expenseAgg.count} ta yozuv`}
        />
        <StatCard label="Jami daromad" value={formatAmount(incomeAgg.sum)} />
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold text-foreground">
            Kunlik xarajatlar
          </h2>
          <span className="text-[12px] text-muted">oxirgi 14 kun</span>
        </div>
        <ExpensesChart data={chartData} />
      </div>
    </div>
  );
}
