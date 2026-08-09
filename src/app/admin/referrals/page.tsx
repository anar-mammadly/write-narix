import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ReferralApprovalRow } from "@/components/admin/referral-approval-row";

export default async function AdminReferralsPage() {
  const supabase = await createServerSupabaseClient();
  const dict = await getDictionary();
  const t = dict.admin.referrals;

  const { data: pending } = await supabase
    .from("referrals")
    .select(
      "id, created_at, referral_codes(code), orders(order_number), referrer:profiles!referrals_referrer_user_id_fkey(full_name), referred:profiles!referrals_referred_user_id_fkey(full_name)"
    )
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="mt-6 rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {(pending ?? []).map((r) => {
            const code = Array.isArray(r.referral_codes) ? r.referral_codes[0] : r.referral_codes;
            const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
            const referrer = Array.isArray(r.referrer) ? r.referrer[0] : r.referrer;
            const referred = Array.isArray(r.referred) ? r.referred[0] : r.referred;
            return (
              <ReferralApprovalRow
                key={r.id}
                id={r.id}
                code={code?.code ?? ""}
                orderNumber={order?.order_number ?? ""}
                referrerName={referrer?.full_name ?? "—"}
                referredName={referred?.full_name ?? "—"}
                dict={dict}
              />
            );
          })}
          {(!pending || pending.length === 0) && (
            <li className="px-5 py-10 text-center text-sm text-muted-foreground">{t.empty}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
