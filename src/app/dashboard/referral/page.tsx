import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatMessage } from "@/lib/i18n/format";
import { ReferralCard } from "@/components/dashboard/referral-card";

export default async function ReferralPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, dict] = await Promise.all([supabase.auth.getUser(), getDictionary()]);
  if (!userData.user) return null;

  const [{ data: profile }, { data: referralCode }, { data: referrals }, { data: benefits }] = await Promise.all([
    supabase.from("profiles").select("referral_code").eq("id", userData.user.id).single(),
    supabase.from("referral_codes").select("code, current_uses, max_total_uses").eq("owner_user_id", userData.user.id).single(),
    supabase
      .from("referrals")
      .select("id, status, created_at")
      .eq("referrer_user_id", userData.user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("referral_benefits")
      .select("id, benefit_type, percentage, status, expires_at")
      .eq("beneficiary_user_id", userData.user.id)
      .order("created_at", { ascending: false }),
  ]);

  const t = dict.dashboard.referral;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <ReferralCard code={profile?.referral_code ?? referralCode?.code ?? ""} dict={dict} />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-foreground">{t.usage}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatMessage(t.usesOf, { used: referralCode?.current_uses ?? 0, max: referralCode?.max_total_uses ?? 3 })}
          </p>
          <ul className="mt-3 space-y-2">
            {(referrals ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
                <span className="text-muted-foreground">{dict.statusLabels[r.status]}</span>
              </li>
            ))}
            {(!referrals || referrals.length === 0) && <p className="text-sm text-muted-foreground">{t.noReferrals}</p>}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground">{t.yourBenefits}</h2>
          <ul className="mt-3 space-y-2">
            {(benefits ?? []).map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>{b.benefit_type === "referrer_reward" ? t.referrerReward : t.referredDiscount} — {b.percentage}%</span>
                <span className="text-muted-foreground">{dict.statusLabels[b.status]}</span>
              </li>
            ))}
            {(!benefits || benefits.length === 0) && <p className="text-sm text-muted-foreground">{t.noBenefits}</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
