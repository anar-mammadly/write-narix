"use server";

import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import type { CalculatorSelection } from "@/lib/actions/pricing";
import { describePricingError } from "@/lib/pricing-errors";

export type CreateOrderInput = CalculatorSelection & {
  subject: string;
  topic: string;
  description: string;
  university?: string | null;
  college?: string | null;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  referralCode?: string | null;
};

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      finalPrice: number;
      guestToken: string | null;
      referralStatus: string | null;
      promoStatus: string | null;
    }
  | { ok: false; error: string };

// The only place an order is ever written. create_order() (SECURITY
// DEFINER, Postgres) re-derives auth.uid() itself and recomputes the full
// price server-side — nothing the client sends here is trusted as a price.
export async function createOrderAction(input: CreateOrderInput): Promise<CreateOrderResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`create-order:${ip}`, 5, 60_000)) {
    return { ok: false, error: "Too many orders submitted — please wait a moment and try again." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    if (!input.guestEmail || input.guestEmail.trim().length === 0) {
      return { ok: false, error: "Enter an email address so we can send your order confirmation." };
    }
    if (!input.guestPhone || input.guestPhone.trim().length === 0) {
      return { ok: false, error: "Enter a phone number so we can reach you about your order." };
    }
    if (!input.guestName || input.guestName.trim().length === 0) {
      return { ok: false, error: "Enter your first and last name." };
    }
  }

  const { data, error } = await supabase.rpc("create_order", {
    p_payload: {
      guest_name: input.guestName ?? null,
      guest_email: input.guestEmail ?? null,
      guest_phone: input.guestPhone ?? null,
      service_id: input.serviceId,
      academic_level_id: input.academicLevelId,
      deadline_option_id: input.deadlineOptionId,
      word_count: input.wordCount,
      page_count: input.pageCount,
      language_id: input.languageId,
      citation_style_id: input.citationStyleId,
      additional_service_ids: input.additionalServiceIds,
      subject: input.subject,
      topic: input.topic,
      description: input.description,
      university: input.university ?? null,
      college: input.college ?? null,
      promo_code: input.promoCode,
      referral_code: input.referralCode ?? null,
    },
  });

  if (error) {
    const message = error.message.includes("PROMO_CODE_NO_LONGER_AVAILABLE")
      ? "That promo code was just used up — please remove it and try again."
      : error.message.includes("BELOW_MINIMUM_PAGES") || error.message.includes("INVALID_PAGE_COUNT") || error.message.includes("NO_PRICING_RULE")
      ? describePricingError(error.message)
      : "We couldn't submit your order. Please try again.";
    return { ok: false, error: message };
  }

  const result = data as unknown as {
    order_id: string;
    order_number: string;
    final_price: string | number;
    guest_token: string | null;
    referral_status: string | null;
    promo_status: string | null;
  };

  return {
    ok: true,
    orderId: result.order_id,
    orderNumber: result.order_number,
    finalPrice: Number(result.final_price),
    guestToken: result.guest_token,
    referralStatus: result.referral_status,
    promoStatus: result.promo_status,
  };
}
