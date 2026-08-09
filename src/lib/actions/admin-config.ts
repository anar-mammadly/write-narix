"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export async function updateDiscountAction(id: string, percentage: number, active: boolean) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("discounts").update({ percentage, active }).eq("id", id);
  if (error) return { ok: false, error: "Could not update discount." };
  revalidatePath("/admin/discounts");
  return { ok: true };
}

export async function createOrderStatusAction(name: string, color: string, displayOrder: number) {
  const supabase = await createServerSupabaseClient();
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const { error } = await supabase.from("order_statuses").insert({ name, slug, color, display_order: displayOrder });
  if (error) return { ok: false, error: "Could not create status." };
  revalidatePath("/admin/statuses");
  return { ok: true };
}

export async function toggleOrderStatusActiveAction(id: string, isActive: boolean) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("order_statuses").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: "Could not update status." };
  revalidatePath("/admin/statuses");
  return { ok: true };
}

export async function updateSiteSettingAction(key: string, value: Json) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("site_settings").upsert({ key, value });
  if (error) return { ok: false, error: "Could not save setting." };
  revalidatePath("/admin/settings");
  return { ok: true };
}
