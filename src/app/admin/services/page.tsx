import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ServicePricingRow } from "@/components/admin/service-pricing-row";

export default async function AdminServicesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: services }, { data: rules }, dict] = await Promise.all([
    supabase.from("services").select("id, name").eq("is_active", true).order("display_order"),
    supabase.from("service_pricing_rules").select("*"),
    getDictionary(),
  ]);
  const t = dict.admin.services;

  const ruleMap = new Map((rules ?? []).map((r) => [r.service_id, r]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Price is based only on service and page count — never academic level or deadline. &ldquo;Progressive&rdquo;
        prices the first N pages one way, then a different per-page rate after. &ldquo;Per page&rdquo; is a straight
        rate, optionally with a required minimum page count.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {(services ?? []).map((s) => (
            <ServicePricingRow key={s.id} serviceId={s.id} serviceName={s.name} rule={ruleMap.get(s.id) ?? null} dict={dict} />
          ))}
        </ul>
      </div>
    </div>
  );
}
