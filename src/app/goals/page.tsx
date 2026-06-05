import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Maqsadlar</h1>
          <p className="mt-1 text-sm text-gray-500">
            Jamg&apos;arma maqsadlaringizni belgilang va kuzating.
          </p>
        </div>

        <GoalsClient goals={goals} />
      </div>
    </AppShell>
  );
}
