import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Badge } from "@/components/ui/badge";

export default async function DashboardOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, dict] = await Promise.all([supabase.auth.getUser(), getDictionary()]);
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email_verified")
    .eq("id", userData.user.id)
    .single();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, final_price, paid_amount, remaining_amount, created_at, order_statuses(name, color), services(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  const activeOrders = (orders ?? []).length;
  const remainingTotal = (orders ?? []).reduce((sum, o) => sum + Number(o.remaining_amount), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {dict.dashboard.overview.welcome}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
      </h1>
      {profile && !profile.email_verified && (
        <p className="mt-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-foreground">
          {dict.dashboard.overview.verifyReminder}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={dict.dashboard.overview.recentOrdersCount} value={String(activeOrders)} />
        <StatCard label={dict.dashboard.overview.remainingBalance} value={`${remainingTotal.toFixed(2)} ${dict.common.currency}`} />
        <StatCard label={dict.dashboard.overview.unreadMessages} value="0" />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium text-foreground">{dict.dashboard.overview.recentOrders}</h2>
          <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">{dict.dashboard.overview.viewAll}</Link>
        </div>
        {orders && orders.length > 0 ? (
          <ul className="divide-y divide-border">
            {orders.map((order) => {
              const status = Array.isArray(order.order_statuses) ? order.order_statuses[0] : order.order_statuses;
              const service = Array.isArray(order.services) ? order.services[0] : order.services;
              return (
                <li key={order.id}>
                  <Link href={`/dashboard/orders/${order.order_number}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{order.order_number}</p>
                      <p className="truncate text-xs text-muted-foreground">{service?.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                      <Badge style={{ backgroundColor: status?.color, color: "white" }}>{status?.name}</Badge>
                      <span className="text-sm font-medium text-foreground">{Number(order.final_price).toFixed(2)} {dict.common.currency}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">{dict.dashboard.overview.noOrders}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-heading text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
