import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import TelegramConnect from "./TelegramConnect";

export default async function TelegramPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims) {
    redirect("/login");
  }

  const { data: link } = await supabase
    .from("telegram_links")
    .select("telegram_username")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Telegram bot</h1>
          <p className="mt-1 text-sm text-muted">
            Xarajatlaringizni Telegram orqali yozing.
          </p>
        </div>

        <TelegramConnect
          linked={!!link}
          username={link?.telegram_username ?? null}
        />
      </div>
    </AppShell>
  );
}
