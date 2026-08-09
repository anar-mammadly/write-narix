"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  university: z.string().optional(),
  country: z.string().optional(),
});

export type ProfileActionResult = { error: string | null; success?: boolean };

export async function updateProfileAction(
  _prev: ProfileActionResult,
  formData: FormData
): Promise<ProfileActionResult> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    university: formData.get("university"),
    country: formData.get("country"),
  });
  if (!parsed.success) return { error: "Please check your entries." };

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sign in required." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      university: parsed.data.university || null,
      country: parsed.data.country || null,
    })
    .eq("id", userData.user.id);

  if (error) return { error: "Could not save your profile." };
  revalidatePath("/dashboard/profile");
  return { error: null, success: true };
}
