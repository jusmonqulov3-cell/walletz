"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount, formatDate } from "@/lib/format";

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  expenseCount: number;
  totalSpent: number;
  banned: boolean;
};

function UserRow({ row }: { row: AdminUserRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleBan() {
    if (busy) return;
    const ban = !row.banned;
    if (
      !confirm(
        ban
          ? `${row.email} ni bloklaysizmi?`
          : `${row.email} ni blokdan chiqarasizmi?`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.id, ban }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-foreground">
            {row.email}
          </span>
          {row.banned && (
            <span className="rounded-md bg-negative/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-negative">
              Bloklangan
            </span>
          )}
        </div>
        {error && <div className="mt-1 text-[11px] text-negative">{error}</div>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-muted">
        {formatDate(row.createdAt)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-muted">
        {row.lastSignInAt ? formatDate(row.lastSignInAt) : "—"}
      </td>
      <td className="mono px-3 py-2.5 text-right text-[12.5px] text-foreground">
        {row.expenseCount}
      </td>
      <td className="mono whitespace-nowrap px-3 py-2.5 text-right text-[12.5px] text-foreground">
        {formatAmount(row.totalSpent)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={toggleBan}
          disabled={busy}
          className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60 ${
            row.banned
              ? "border border-border text-foreground hover:bg-[var(--subtle)]"
              : "bg-negative text-white hover:opacity-90"
          }`}
        >
          {busy ? "..." : row.banned ? "Blokdan chiqarish" : "Bloklash"}
        </button>
      </td>
    </tr>
  );
}

export default function AdminUsersClient({ rows }: { rows: AdminUserRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Email bo'yicha qidirish"
        className="input max-w-sm"
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Ro&apos;yxatdan</th>
              <th className="px-3 py-2.5">Oxirgi faollik</th>
              <th className="px-3 py-2.5 text-right">Xarajat soni</th>
              <th className="px-3 py-2.5 text-right">Jami sarflangan</th>
              <th className="px-3 py-2.5 text-right">Amal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr className="border-t border-border">
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-[13px] text-muted"
                >
                  Foydalanuvchi topilmadi
                </td>
              </tr>
            ) : (
              filtered.map((r) => <UserRow key={r.id} row={r} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
