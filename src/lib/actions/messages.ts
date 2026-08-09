"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SendMessageResult =
  | { ok: true; message: { id: string; body: string | null; sender_is_admin: boolean; created_at: string } }
  | { ok: false; error: string };

export async function sendMessageAction(orderId: string, body: string): Promise<SendMessageResult> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Sign in required." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  const senderIsAdmin = profile?.role === "admin";

  const { data, error } = await supabase
    .from("messages")
    .insert({
      order_id: orderId,
      sender_id: userData.user.id,
      sender_is_admin: senderIsAdmin,
      body,
    })
    .select("id, body, sender_is_admin, created_at")
    .single();

  if (error || !data) return { ok: false, error: "Message could not be sent." };
  return { ok: true, message: data };
}
