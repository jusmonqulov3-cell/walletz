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
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900">Daromad</h1>

        {/* This month income */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Bu oy daromad</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600">
            {formatAmount(monthTotal)}
          </p>
        </div>

        {/* Quick input */}
        <QuickIncome />

        {/* Recent incomes */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            So&apos;nggi daromadlar
          </h2>

          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-base font-medium text-gray-900">
                Birinchi daromadingizni kiriting ↑
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {r.source || "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(r.received_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-emerald-600">
                    {formatAmount(r.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
