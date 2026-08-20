import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { OneClickOrderStatusSelect } from "@/components/admin/one-click-order-status-select";
import type { OneClickOrderStatus } from "@/lib/actions/one-click-orders";

export default async function AdminOneClickOrdersPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: rows }, dict] = await Promise.all([
    supabase
      .from("one_click_orders")
      .select("id, topic, phone, email, status, created_at, services(name), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(100),
    getDictionary(),
  ]);
  const t = dict.admin.oneClickOrders;
  const statusLabels: Record<OneClickOrderStatus, string> = {
    new: t.statusNew,
    contacted: t.statusContacted,
    converted: t.statusConverted,
    cancelled: t.statusCancelled,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      {(rows ?? []).length === 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card px-5 py-8 text-center text-muted-foreground">{t.empty}</div>
      )}

      <div className="mt-6 grid gap-3 sm:hidden">
        {(rows ?? []).map((row) => {
          const service = Array.isArray(row.services) ? row.services[0] : row.services;
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return (
            <div key={row.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{row.topic}</p>
                <OneClickOrderStatusSelect id={row.id} status={row.status as OneClickOrderStatus} labels={statusLabels} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{service?.name}</p>
              <p className="text-sm text-muted-foreground">{profile?.full_name ?? t.guest}</p>
              <p className="text-sm text-muted-foreground">{row.phone ?? row.email}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-5 py-3">{t.date}</th>
              <th className="px-5 py-3">{t.topic}</th>
              <th className="px-5 py-3">{t.service}</th>
              <th className="px-5 py-3">{t.customer}</th>
              <th className="px-5 py-3">{t.contact}</th>
              <th className="px-5 py-3">{t.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(rows ?? []).map((row) => {
              const service = Array.isArray(row.services) ? row.services[0] : row.services;
              const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              return (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">{row.topic}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{service?.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{profile?.full_name ?? t.guest}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    <div>{row.phone}</div>
                    <div className="text-xs">{row.email}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <OneClickOrderStatusSelect id={row.id} status={row.status as OneClickOrderStatus} labels={statusLabels} />
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
