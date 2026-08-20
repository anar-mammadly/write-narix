"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export type CreateOneClickOrderInput = {
  serviceId: string;
  topic: string;
  phone?: string;
  email?: string;
};

export type CreateOneClickOrderResult = { ok: true; id: string } | { ok: false; error: string };

// Separate lead-capture flow from the full checkout: create_one_click_order()
// (SECURITY DEFINER, Postgres) pulls phone/email from the caller's own
// profile/auth account when signed in, so a logged-in user only needs to
// submit topic + service.
export async function createOneClickOrderAction(input: CreateOneClickOrderInput): Promise<CreateOneClickOrderResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`one-click-order:${ip}`, 5, 60_000)) {
    return { ok: false, error: "Too many requests submitted — please wait a moment and try again." };
  }

  if (!input.topic || input.topic.trim().length === 0) {
    return { ok: false, error: "topicRequired" };
  }
  if (!input.serviceId) {
    return { ok: false, error: "serviceRequired" };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    if (!input.phone || input.phone.trim().length === 0) {
      return { ok: false, error: "phoneRequired" };
    }
    if (!input.email || input.email.trim().length === 0) {
      return { ok: false, error: "emailRequired" };
    }
  }

  const { data, error } = await supabase.rpc("create_one_click_order", {
    p_payload: {
      service_id: input.serviceId,
      topic: input.topic,
      phone: input.phone ?? null,
      email: input.email ?? null,
    },
  });

  if (error) {
    const message = error.message.includes("PHONE_REQUIRED")
      ? "phoneRequired"
      : error.message.includes("EMAIL_REQUIRED")
      ? "emailRequired"
      : error.message.includes("TOPIC_REQUIRED")
      ? "topicRequired"
      : error.message.includes("INVALID_SERVICE")
      ? "serviceRequired"
      : "generic";
    return { ok: false, error: message };
  }

  const result = data as unknown as { id: string };
  return { ok: true, id: result.id };
}

export type OneClickOrderStatus = "new" | "contacted" | "converted" | "cancelled";

export async function updateOneClickOrderStatusAction(id: string, status: OneClickOrderStatus) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("one_click_orders").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Could not update status." };
  revalidatePath("/admin/one-click-orders");
  return { ok: true };
}
