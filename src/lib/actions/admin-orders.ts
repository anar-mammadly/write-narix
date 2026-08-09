"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function changeOrderStatusAction(orderId: string, newStatusId: string, note: string, orderNumber: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("change_order_status", {
    p_order_id: orderId,
    p_new_status_id: newStatusId,
    p_note: note || null,
  });
  if (error) return { ok: false, error: error.message.includes("ORDER_LOCKED") ? "This order is locked (terminal status). Unlock it first." : "Could not change status." };
  revalidatePath(`/admin/orders/${orderNumber}`);
  return { ok: true };
}

export async function unlockOrderAction(orderId: string, orderNumber: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("unlock_order", { p_order_id: orderId });
  if (error) return { ok: false, error: "Could not unlock order." };
  revalidatePath(`/admin/orders/${orderNumber}`);
  return { ok: true };
}

export async function createPaymentRequestAction(orderId: string, amount: number, description: string, orderNumber: string) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("payment_requests").insert({
    order_id: orderId,
    amount,
    description,
    created_by: userData.user?.id ?? null,
  });
  if (error) return { ok: false, error: "Could not create payment request." };
  revalidatePath(`/admin/orders/${orderNumber}`);
  return { ok: true };
}

export async function recordPaymentAction(orderId: string, amount: number, method: string, paymentRequestId: string | null, orderNumber: string) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Sign in required." };

  const { error } = await supabase.from("payments").insert({
    order_id: orderId,
    amount,
    method,
    recorded_by: userData.user.id,
    payment_request_id: paymentRequestId,
  });
  if (error) return { ok: false, error: "Could not record payment." };

  if (paymentRequestId) {
    await supabase.from("payment_requests").update({ status: "paid" }).eq("id", paymentRequestId);
  }

  revalidatePath(`/admin/orders/${orderNumber}`);
  return { ok: true };
}

export async function createOrderRequestAction(orderId: string, title: string, description: string, orderNumber: string) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("order_requests").insert({
    order_id: orderId,
    title,
    description,
    created_by: userData.user?.id ?? null,
  });
  if (error) return { ok: false, error: "Could not create request." };
  revalidatePath(`/admin/orders/${orderNumber}`);
  return { ok: true };
}
