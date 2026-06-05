import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the service-role key. Bypasses RLS — use ONLY in
 * trusted server contexts that have no user session (e.g. the Telegram webhook),
 * and always scope queries by user_id yourself.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
