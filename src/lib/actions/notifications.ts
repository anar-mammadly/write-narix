"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function markNotificationsReadAction(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = await createServerSupabaseClient();
  await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  revalidatePath("/dashboard/notifications");
}
