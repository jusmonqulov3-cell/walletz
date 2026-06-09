import "server-only";

// Comma-separated env lists → a trimmed Set (empty entries dropped).
function parseList(value?: string): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// Primary allowlist: immutable Supabase user UIDs. UIDs can't be claimed by
// registering an email, so this is the robust, takeover-proof gate.
const ADMIN_USER_IDS = parseList(process.env.ADMIN_USER_IDS);

// Optional secondary allowlist: emails. Only honored for a CONFIRMED email, so
// it relies on Supabase email confirmation being enabled. Prefer UIDs.
const ADMIN_EMAILS = new Set(
  [...parseList(process.env.ADMIN_EMAILS)].map((e) => e.toLowerCase()),
);

export type AdminCheckUser = {
  id?: string | null;
  email?: string | null;
  email_confirmed_at?: string | null;
};

/**
 * Returns true only if `user` is an allowlisted admin.
 *
 * - Matches an immutable user UID in ADMIN_USER_IDS (preferred), OR
 * - Matches a CONFIRMED email in ADMIN_EMAILS (case-insensitive).
 *
 * Server-only — relies on non-public env vars that must never reach the client.
 * Fails closed: no user, or empty allowlists, ⇒ false.
 */
export function isAdmin(user?: AdminCheckUser | null): boolean {
  if (!user) return false;
  if (user.id && ADMIN_USER_IDS.has(user.id)) return true;
  if (
    user.email &&
    user.email_confirmed_at &&
    ADMIN_EMAILS.has(user.email.trim().toLowerCase())
  ) {
    return true;
  }
  return false;
}
