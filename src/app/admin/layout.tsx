import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const [{ count }, dict] = await Promise.all([
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
    getDictionary(),
  ]);

  return <AdminShell pendingReferrals={count ?? 0} dict={dict}>{children}</AdminShell>;
}
