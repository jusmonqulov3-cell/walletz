import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format";
import AppShell from "@/components/AppShell";
import { getDict } from "@/lib/i18n/server";
import GoalsClient, { type Goal } from "./GoalsClient";

type GoalRow = {
  id: string;
  title: string;
  target_amount: number;
  saved_amount: number;
  target_date: string | null;
};

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("goals")
    .select("id, title, target_amount, saved_amount, target_date")
    .order("created_at", { ascending: false });

  const goals: Goal[] = ((data ?? []) as GoalRow[]).map((g) => ({
    id: g.id,
    title: g.title,
    target_amount: Number(g.target_amount),
    saved_amount: Number(g.saved_amount),
    target_date: g.target_date,
  }));

  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);
  const overallPct =
    totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const t = await getDict();

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div>
            <div className="title">{t.goals.title}</div>
            <div className="sub">{t.goals.activeGoals(goals.length)}</div>
          </div>
        </div>

        {goals.length > 0 && (
          <div className="hero">
            <div className="h-lbl">Jami jamg&apos;arilgan</div>
            <div className="h-val mono">{formatAmount(totalSaved)}</div>
            <div className="h-meta">
              <span>{formatAmount(totalTarget)} maqsaddan</span>
              <span className="h-delta gain">{overallPct}%</span>
            </div>
            <div className="bar" style={{ marginTop: 13 }}>
              <i style={{ width: `${overallPct}%` }} />
            </div>
          </div>
        )}

        <div className="section">
          <GoalsClient goals={goals} />
        </div>
      </div>
    </AppShell>
  );
}
