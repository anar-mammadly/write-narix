import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, dict] = await Promise.all([supabase.auth.getUser(), getDictionary()]);

  let unreadCount = 0;
  if (userData.user) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .eq("is_read", false);
    unreadCount = count ?? 0;
  }

  return <DashboardShell unreadCount={unreadCount} dict={dict}>{children}</DashboardShell>;
}
