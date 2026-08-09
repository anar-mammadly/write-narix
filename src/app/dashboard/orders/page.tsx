import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Badge } from "@/components/ui/badge";

export default async function OrdersListPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: orders }, dict] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, final_price, remaining_amount, created_at, order_statuses(name, color), services(name)")
      .order("created_at", { ascending: false }),
    getDictionary(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{dict.dashboard.orders.title}</h1>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        {orders && orders.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-3">{dict.dashboard.orders.order}</th>
                <th className="px-5 py-3">{dict.dashboard.orders.service}</th>
                <th className="px-5 py-3">{dict.dashboard.orders.status}</th>
                <th className="px-5 py-3 text-right">{dict.dashboard.orders.total}</th>
                <th className="px-5 py-3 text-right">{dict.dashboard.orders.remaining}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => {
                const status = Array.isArray(order.order_statuses) ? order.order_statuses[0] : order.order_statuses;
                const service = Array.isArray(order.services) ? order.services[0] : order.services;
                return (
                  <tr key={order.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5">
                      <Link href={`/dashboard/orders/${order.order_number}`} className="font-medium text-primary hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{service?.name}</td>
                    <td className="px-5 py-3.5">
                      <Badge style={{ backgroundColor: status?.color, color: "white" }}>{status?.name}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums">{Number(order.final_price).toFixed(2)} {dict.common.currency}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{Number(order.remaining_amount).toFixed(2)} {dict.common.currency}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {dict.dashboard.orders.empty} <Link href="/#calculator" className="text-primary hover:underline">{dict.dashboard.orders.placeFirst}</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
