import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { getDict } from "@/lib/i18n/server";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Telegram link status (own row only — guarded by RLS).
  const { data: link } = await supabase
    .from("telegram_links")
    .select("telegram_username, notify")
    .eq("user_id", user.id)
    .maybeSingle();

  const t = await getDict();

  const metaName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "";

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-5">
        <div className="appbar">
          <div>
            <div className="title">{t.menu.profile}</div>
            <div className="sub">{user.email ?? ""}</div>
          </div>
        </div>

        <ProfileClient
          email={user.email ?? ""}
          name={metaName}
          createdAt={user.created_at ?? null}
          telegramUsername={link?.telegram_username ?? null}
          telegramNotify={link?.notify ?? false}
        />
      </div>
    </AppShell>
  );
}
