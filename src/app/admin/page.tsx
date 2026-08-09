import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const dict = await getDictionary();

  const [{ count: totalOrders }, { count: pendingReferrals }, { count: pendingPayments }, { data: recentOrders }] =
    await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
      supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("orders")
        .select(
          "id, order_number, guest_name, final_price, created_at, order_statuses(name, color), services(name), profiles!orders_user_id_fkey(full_name)"
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const { data: revenueRows } = await supabase.from("orders").select("paid_amount");
  const revenue = (revenueRows ?? []).reduce((sum, r) => sum + Number(r.paid_amount), 0);
  const t = dict.admin.overview;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label={t.totalOrders} value={String(totalOrders ?? 0)} />
        <Stat label={t.pendingReferrals} value={String(pendingReferrals ?? 0)} highlight={(pendingReferrals ?? 0) > 0} />
        <Stat label={t.pendingPayments} value={String(pendingPayments ?? 0)} />
        <Stat label={t.revenue} value={`${revenue.toFixed(2)} ${dict.common.currency}`} />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium text-foreground">{t.recentOrders}</h2>
        </div>
        <ul className="divide-y divide-border">
          {(recentOrders ?? []).length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">{dict.admin.orders.empty}</li>
          )}
          {(recentOrders ?? []).map((order) => {
            const status = Array.isArray(order.order_statuses) ? order.order_statuses[0] : order.order_statuses;
            const service = Array.isArray(order.services) ? order.services[0] : order.services;
            const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
            return (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.order_number}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-primary">{order.order_number}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {profile?.full_name ?? order.guest_name ?? dict.admin.orders.guest}
                      {service?.name ? ` · ${service.name}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span style={{ color: status?.color }}>{status?.name}</span>
                    <span className="tabular-nums text-muted-foreground">{Number(order.final_price).toFixed(2)} {dict.common.currency}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "border-warning/40 bg-warning-soft" : "border-border bg-card"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-heading text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
