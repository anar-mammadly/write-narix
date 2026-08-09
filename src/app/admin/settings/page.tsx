import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { WhatsAppSettingsForm, EarlyOrderBannerForm, ReferralValidityForm } from "@/components/admin/settings-form";
import type { Json } from "@/lib/supabase/database.types";

export default async function AdminSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data }, dict] = await Promise.all([
    supabase.from("site_settings").select("key, value"),
    getDictionary(),
  ]);
  const map = new Map<string, Json>((data ?? []).map((r) => [r.key, r.value]));

  const whatsapp = (map.get("whatsapp") as { number?: string; display?: string } | undefined) ?? {};
  const banner = (map.get("early_order_banner") as { enabled?: boolean; text?: string; text_en?: string } | undefined) ?? {};
  const referral = (map.get("referral_program") as { validity_days?: number } | undefined) ?? {};

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{dict.admin.settings.title}</h1>

      <div className="mt-6 grid gap-5">
        <WhatsAppSettingsForm number={whatsapp.number ?? ""} display={whatsapp.display ?? ""} dict={dict} />
        <EarlyOrderBannerForm
          enabled={banner.enabled ?? false}
          text={banner.text ?? ""}
          textEn={banner.text_en ?? ""}
          dict={dict}
        />
        <ReferralValidityForm validityDays={referral.validity_days ?? 90} dict={dict} />
      </div>
    </div>
  );
}
