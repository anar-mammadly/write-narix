import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/config";
import { localizeRows } from "@/lib/i18n/localize";

export async function getCalculatorConfig(locale: Locale) {
  const supabase = await createServerSupabaseClient();

  const [
    services,
    academicLevels,
    deadlineOptions,
    languages,
    citationStyles,
    additionalServices,
    pricingRules,
    serviceDeadlines,
  ] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, slug, description, category_id, display_order, translations")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("academic_levels")
      .select("id, name, slug, display_order, translations")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("deadline_options")
      .select("id, label, duration_hours, display_order, translations")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("languages")
      .select("id, name, code, display_order, translations")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("citation_styles")
      .select("id, name, display_order")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("additional_services")
      .select("id, name, description, price_type, price_value, is_plagiarism_addon, display_order, translations")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("service_pricing_rules")
      .select("service_id, pricing_type, base_pages, base_mode, base_price, additional_page_price, price_per_page, minimum_pages"),
    supabase
      .from("service_deadline_options")
      .select("service_id, deadline_option_id, surcharge_percent, is_default"),
  ]);

  return {
    services: localizeRows(services.data ?? [], locale, ["name", "description"]),
    academicLevels: localizeRows(academicLevels.data ?? [], locale, ["name"]),
    deadlineOptions: localizeRows(deadlineOptions.data ?? [], locale, ["label"]),
    languages: localizeRows(languages.data ?? [], locale, ["name"]),
    citationStyles: citationStyles.data ?? [],
    additionalServices: localizeRows(additionalServices.data ?? [], locale, ["name", "description"]),
    pricingRules: pricingRules.data ?? [],
    serviceDeadlines: serviceDeadlines.data ?? [],
  };
}

export type CalculatorConfig = Awaited<ReturnType<typeof getCalculatorConfig>>;
export type ServicePricingRule = CalculatorConfig["pricingRules"][number];
export type ServiceDeadlineOption = CalculatorConfig["serviceDeadlines"][number];
