"use server";

import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { describePricingError } from "@/lib/pricing-errors";

export type PriceCandidate = {
  source: "member" | "early_order" | "referral" | "promo";
  reference_id: string | null;
  percentage: number;
  amount: number;
};

export type AddonBreakdownItem = {
  id: string;
  name: string;
  price_type: "fixed" | "percentage";
  price_value: number;
  computed_price: number;
  is_plagiarism_addon: boolean;
};

export type PricePreview = {
  base_price: number;
  addons_total: number;
  addons_breakdown: AddonBreakdownItem[];
  deadline_surcharge_percent: number;
  deadline_surcharge_amount: number;
  subtotal: number;
  candidates: PriceCandidate[];
  applied: PriceCandidate | null;
  final_price: number;
};

export type CalculatorSelection = {
  serviceId: string;
  academicLevelId: string;
  deadlineOptionId: string;
  wordCount: number | null;
  pageCount: number | null;
  languageId: string | null;
  citationStyleId: string | null;
  additionalServiceIds: string[];
  promoCode: string | null;
};

export type PreviewResult = { data: PricePreview | null; error: string | null };

// Calculator preview: READ-ONLY. Calls the pure preview_price() RPC, which
// itself calls the pure calculate_price() engine — neither writes a single
// row. Nothing here ever touches discount_applications, orders, or any
// other table; only create_order() (see orders.ts) persists anything, once,
// at real submission. Rate-limited per caller so a rapid typing burst can't
// hammer Postgres — the client additionally debounces before calling this.
export async function previewPriceAction(selection: CalculatorSelection): Promise<PreviewResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`preview:${ip}`, 20, 10_000)) {
    return { data: null, error: "Too many requests — please slow down." };
  }

  if (!selection.serviceId || !selection.academicLevelId || !selection.deadlineOptionId || !selection.pageCount) {
    return { data: null, error: null };
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("preview_price", {
    p_service_id: selection.serviceId,
    p_academic_level_id: selection.academicLevelId,
    p_deadline_option_id: selection.deadlineOptionId,
    p_word_count: selection.wordCount,
    p_page_count: selection.pageCount,
    p_language_id: selection.languageId,
    p_citation_style_id: selection.citationStyleId,
    p_additional_service_ids: selection.additionalServiceIds,
    p_promo_code: selection.promoCode,
  });

  if (error) {
    return { data: null, error: describePricingError(error.message) };
  }

  return { data: data as unknown as PricePreview, error: null };
}

export async function validatePromoCodeAction(code: string): Promise<{ valid: boolean; reason?: string; percentage?: number }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("validate_promo_code", { p_code: code });
  if (error || !data) return { valid: false };
  const result = data as unknown as { valid: boolean; reason?: string; percentage?: number };
  return result;
}
