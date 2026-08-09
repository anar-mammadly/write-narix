import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Badge } from "@/components/ui/badge";
import { OrderRowActions } from "@/components/admin/order-row-actions";

export default async function AdminOrdersPage() {
  const supabase = await createServerSupabaseClient();
  // orders has two FKs into profiles (user_id and assigned_to) — the
  // embed must be disambiguated by FK name, or PostgREST rejects the
  // whole query (PGRST201) and the page silently renders zero rows.
  const [{ data: orders }, dict] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, guest_name, guest_email, final_price, remaining_amount, created_at, order_statuses(name, color), services(name), profiles!orders_user_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    getDictionary(),
  ]);
  const t = dict.admin.orders;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t.title}</h1>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-5 py-3">{t.order}</th>
              <th className="px-5 py-3">{t.client}</th>
              <th className="px-5 py-3">{t.service}</th>
              <th className="px-5 py-3">{t.status}</th>
              <th className="px-5 py-3 text-right">{t.total}</th>
              <th className="px-5 py-3 text-right">{t.remaining}</th>
              <th className="px-5 py-3"><span className="sr-only">{t.actions}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(orders ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">{t.empty}</td>
              </tr>
            )}
            {(orders ?? []).map((order) => {
              const status = Array.isArray(order.order_statuses) ? order.order_statuses[0] : order.order_statuses;
              const service = Array.isArray(order.services) ? order.services[0] : order.services;
              const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
              return (
                <tr key={order.id} className="hover:bg-muted/40">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/orders/${order.order_number}`} className="font-medium text-primary hover:underline">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{profile?.full_name ?? order.guest_name ?? order.guest_email ?? t.guest}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{service?.name}</td>
                  <td className="px-5 py-3.5"><Badge style={{ backgroundColor: status?.color, color: "white" }}>{status?.name}</Badge></td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-medium">{Number(order.final_price).toFixed(2)} {dict.common.currency}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{Number(order.remaining_amount).toFixed(2)} {dict.common.currency}</td>
                  <td className="px-5 py-3.5 text-right">
                    <OrderRowActions orderNumber={order.order_number} actionsLabel={t.actions} viewDetailsLabel={t.viewDetails} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
