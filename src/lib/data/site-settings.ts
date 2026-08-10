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

export type PromoPopupConfig = { title: string; description: string; ctaText: string };
type PromoPopupSetting = {
  enabled?: boolean;
  title?: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  cta_text?: string;
  cta_text_en?: string;
  start_date?: string | null;
  end_date?: string | null;
};

// Returns the popup content to show, or null if the popup is disabled, has
// no content, or the current time falls outside its optional start/end
// window — all decided server-side so the client only ever receives
// something when it should actually render.
export async function getPromoPopup(locale: Locale = "az"): Promise<PromoPopupConfig | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "promo_popup").maybeSingle();
  const popup = (data?.value as PromoPopupSetting | undefined) ?? {};

  if (!popup.enabled) return null;

  const now = Date.now();
  if (popup.start_date && now < new Date(popup.start_date).getTime()) return null;
  if (popup.end_date && now > new Date(popup.end_date).getTime()) return null;

  const title = (locale === "en" ? popup.title_en : popup.title) || popup.title || "";
  const description = (locale === "en" ? popup.description_en : popup.description) || popup.description || "";
  const ctaText = (locale === "en" ? popup.cta_text_en : popup.cta_text) || popup.cta_text || "";

  if (!title && !description) return null;

  return { title, description, ctaText };
}
