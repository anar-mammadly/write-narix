import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DiscountRow } from "@/components/admin/discount-row";

export default async function AdminDiscountsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: discounts }, dict] = await Promise.all([
    supabase.from("discounts").select("id, type, name, percentage, active").order("created_at"),
    getDictionary(),
  ]);
  const t = dict.admin.discounts;

  const labels: Record<string, string> = {
    member: t.member,
    early_order: t.earlyOrder,
    referral: t.referral,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="mt-6 rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {(discounts ?? []).map((d) => (
            <DiscountRow key={d.id} id={d.id} name={labels[d.type] ?? d.name} percentage={Number(d.percentage ?? 0)} active={d.active} dict={dict} />
          ))}
        </ul>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        {t.promoNote}
      </p>
    </div>
  );
}
