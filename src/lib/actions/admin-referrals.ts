"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function approveReferralAction(referralId: string, percentage: number) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("approve_referral_with_percentage", {
    p_referral_id: referralId,
    p_percentage: percentage,
  });
  if (error) return { ok: false, error: "Could not approve referral." };
  revalidatePath("/admin/referrals");
  revalidatePath("/admin/orders/[orderNumber]", "page");
  return { ok: true };
}

export async function rejectReferralAction(referralId: string, reason: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reject_referral", { p_referral_id: referralId, p_reason: reason || null });
  if (error) return { ok: false, error: "Could not reject referral." };
  revalidatePath("/admin/referrals");
  revalidatePath("/admin/orders/[orderNumber]", "page");
  return { ok: true };
}

export async function approvePromoRequestAction(requestId: string, percentage: number) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("approve_promo_request", {
    p_request_id: requestId,
    p_percentage: percentage,
  });
  if (error) return { ok: false, error: "Could not approve promo code." };
  revalidatePath("/admin/referrals");
  revalidatePath("/admin/orders/[orderNumber]", "page");
  return { ok: true };
}

export async function rejectPromoRequestAction(requestId: string, reason: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reject_promo_request", { p_request_id: requestId, p_reason: reason || null });
  if (error) return { ok: false, error: "Could not reject promo code." };
  revalidatePath("/admin/referrals");
  revalidatePath("/admin/orders/[orderNumber]", "page");
  return { ok: true };
}
