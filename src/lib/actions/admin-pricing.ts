"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ServicePricingPatch =
  | { pricingType: "progressive"; basePages: number; baseMode: "flat" | "linear"; basePrice: number; additionalPagePrice: number }
  | { pricingType: "per_page"; pricePerPage: number; minimumPages: number | null };

export async function updateServicePricingRuleAction(serviceId: string, patch: ServicePricingPatch) {
  const supabase = await createServerSupabaseClient();

  const payload =
    patch.pricingType === "progressive"
      ? {
          pricing_type: "progressive" as const,
          base_pages: patch.basePages,
          base_mode: patch.baseMode,
          base_price: patch.basePrice,
          additional_page_price: patch.additionalPagePrice,
          price_per_page: null,
          minimum_pages: null,
        }
      : {
          pricing_type: "per_page" as const,
          base_pages: null,
          base_mode: null,
          base_price: null,
          additional_page_price: null,
          price_per_page: patch.pricePerPage,
          minimum_pages: patch.minimumPages,
        };

  const { error } = await supabase
    .from("service_pricing_rules")
    .upsert({ service_id: serviceId, ...payload });

  if (error) return { ok: false, error: "Could not update pricing." };
  revalidatePath("/admin/services");
  return { ok: true };
}
