import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Page size for both the auth admin API and table range scans. Supabase caps
// table selects at 1000 rows by default, so we page explicitly to stay accurate.
const PAGE = 1000;

export type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
};

// Fetches every auth user across all pages of the admin listUsers API.
export async function listAllUsers(admin: SupabaseClient): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE,
    });
    if (error) throw error;
    const batch = data?.users ?? [];
    for (const u of batch) {
      users.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until:
          (u as { banned_until?: string | null }).banned_until ?? null,
      });
    }
    if (batch.length < PAGE) break;
    page += 1;
  }
  return users;
}

export type ExpenseRow = { user_id: string; amount: number; spent_at: string };

// Fetches expense rows (optionally since an ISO instant), paging past the cap.
export async function fetchExpenseRows(
  admin: SupabaseClient,
  sinceIso?: string,
): Promise<ExpenseRow[]> {
  const rows: ExpenseRow[] = [];
  let from = 0;
  for (;;) {
    let q = admin.from("expenses").select("user_id, amount, spent_at");
    if (sinceIso) q = q.gte("spent_at", sinceIso);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as ExpenseRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

// Sums a numeric column across an entire table (paged), returning count + sum.
export async function sumColumn(
  admin: SupabaseClient,
  table: string,
  column = "amount",
): Promise<{ count: number; sum: number }> {
  let from = 0;
  let count = 0;
  let sum = 0;
  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select(column)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of batch) sum += Number(r[column]) || 0;
    count += batch.length;
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return { count, sum };
}

// Exact row count without transferring rows.
export async function countRows(
  admin: SupabaseClient,
  table: string,
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// Number of DISTINCT users that have linked a Telegram account.
export async function countTelegramUsers(
  admin: SupabaseClient,
): Promise<number> {
  const ids = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("telegram_links")
      .select("user_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as { user_id: string }[];
    for (const r of batch) ids.add(r.user_id);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return ids.size;
}

// Counts users whose last_sign_in_at falls within the last 7 and 30 days.
// Lives here (not in a component) so the clock read stays out of render.
export function activeUserCounts(users: AuthUser[]): {
  active7: number;
  active30: number;
} {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  let active7 = 0;
  let active30 = 0;
  for (const u of users) {
    if (!u.last_sign_in_at) continue;
    const elapsed = now - new Date(u.last_sign_in_at).getTime();
    if (elapsed <= 7 * DAY) active7 += 1;
    if (elapsed <= 30 * DAY) active30 += 1;
  }
  return { active7, active30 };
}

// True when a banned_until timestamp is in the future (Supabase uses a far-future
// date for indefinite bans).
export function isBanned(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  const t = new Date(bannedUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
}
