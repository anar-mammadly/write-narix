"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ClaimResult = { ok: true } | { ok: false; error: string };

// Mirrors claim_guest_order() exactly: requires a signed-in, email-verified
// account AND the guest tracking token — an email match alone is never
// enough, so this can't be used to silently annex someone else's order.
export async function claimGuestOrderAction(orderNumber: string, token: string): Promise<ClaimResult> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return { ok: false, error: "AUTH_REQUIRED" };
  }

  const { error } = await supabase.rpc("claim_guest_order", {
    p_order_number: orderNumber,
    p_token: token,
  });

  if (error) {
    if (error.message.includes("EMAIL_NOT_VERIFIED")) {
      return { ok: false, error: "Verify your email address before claiming this order." };
    }
    if (error.message.includes("ALREADY_CLAIMED")) {
      return { ok: false, error: "This order has already been linked to an account." };
    }
    return { ok: false, error: "Could not verify this order and tracking link." };
  }

  return { ok: true };
}
