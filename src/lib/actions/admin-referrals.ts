"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function approveReferralAction(referralId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("approve_referral", { p_referral_id: referralId });
  if (error) return { ok: false, error: "Could not approve referral." };
  revalidatePath("/admin/referrals");
  return { ok: true };
}

export async function rejectReferralAction(referralId: string, reason: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reject_referral", { p_referral_id: referralId, p_reason: reason || null });
  if (error) return { ok: false, error: "Could not reject referral." };
  revalidatePath("/admin/referrals");
  return { ok: true };
}
