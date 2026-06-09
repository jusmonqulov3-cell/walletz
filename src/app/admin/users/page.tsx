import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { listAllUsers, fetchExpenseRows, isBanned } from "@/lib/admin-data";
import AdminUsersClient, { type AdminUserRow } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  // Independent admin check — never trust the proxy gate alone.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user)) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const [users, expenses] = await Promise.all([
    listAllUsers(admin),
    fetchExpenseRows(admin),
  ]);

  // Aggregate expense count + sum per user in JS (single batched fetch above).
  const agg = new Map<string, { count: number; sum: number }>();
  for (const e of expenses) {
    const cur = agg.get(e.user_id) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += Number(e.amount) || 0;
    agg.set(e.user_id, cur);
  }

  const rows: AdminUserRow[] = users
    .map((u) => {
      const a = agg.get(u.id) ?? { count: 0, sum: 0 };
      return {
        id: u.id,
        email: u.email ?? "—",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        expenseCount: a.count,
        totalSpent: a.sum,
        banned: isBanned(u.banned_until),
      };
    })
    // Sort by last active, most recent first (never-signed-in users last).
    .sort((a, b) => {
      const ta = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
      const tb = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
      return tb - ta;
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[18px] font-semibold text-foreground">
          Foydalanuvchilar
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {rows.length} ta foydalanuvchi · faqat jami ko&apos;rsatkichlar
        </p>
      </div>

      <AdminUsersClient rows={rows} />
    </div>
  );
}
