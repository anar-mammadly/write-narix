import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { Locale } from "@/lib/i18n/config";

export async function getSiteSettings(locale: Locale = "az") {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("site_settings").select("key, value");

  const map = new Map<string, Json>((data ?? []).map((row) => [row.key, row.value]));

  const whatsapp = (map.get("whatsapp") as { number?: string; display?: string } | undefined) ?? {};
  const earlyOrderBanner =
    (map.get("early_order_banner") as { enabled?: boolean; text?: string; text_en?: string } | undefined) ?? {};
  const company = (map.get("company") as { name?: string; support_email?: string } | undefined) ?? {};
  const currency = (map.get("currency") as { code?: string } | undefined) ?? {};

  return {
    whatsappNumber: whatsapp.number ?? "994515600625",
    whatsappDisplay: whatsapp.display ?? "051-560-06-25",
    earlyOrderBannerEnabled: earlyOrderBanner.enabled ?? false,
    earlyOrderBannerText:
      (locale === "en" ? earlyOrderBanner.text_en : earlyOrderBanner.text) || earlyOrderBanner.text || "",
    companyName: company.name ?? "Narix Academy",
    supportEmail: company.support_email ?? "support@narix.az",
    currencyCode: currency.code ?? "AZN",
  };
}

export function buildWhatsAppUrl(number: string, message?: string) {
  const base = `https://wa.me/${number.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
