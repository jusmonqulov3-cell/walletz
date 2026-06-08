import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import Chat from "./Chat";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims) {
    redirect("/login");
  }

  return (
    <AppShell variant="fill">
      <Chat />
    </AppShell>
  );
}
