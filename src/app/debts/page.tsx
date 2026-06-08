import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import DebtsClient, { type Debt } from "./DebtsClient";

type DebtRow = {
  id: string;
  person: string;
  amount: number;
  direction: "borrowed" | "lent";
  note: string | null;
  settled: boolean;
  created_at: string;
};

export default async function DebtsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("debts")
    .select("id, person, amount, direction, note, settled, created_at")
    .order("created_at", { ascending: false });

  const debts: Debt[] = ((data ?? []) as DebtRow[]).map((d) => ({
    id: d.id,
    person: d.person,
    amount: Number(d.amount),
    direction: d.direction,
    note: d.note,
    settled: d.settled,
    created_at: d.created_at,
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div>
            <div className="title">Qarzlar</div>
            <div className="sub">Olingan va berilgan</div>
          </div>
        </div>

        <DebtsClient debts={debts} />
      </div>
    </AppShell>
  );
}
