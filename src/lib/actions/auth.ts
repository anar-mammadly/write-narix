"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/public-env";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AuthActionResult = { error: string } | { error: null };

export async function signUpAction(
  _prev: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createServerSupabaseClient();
  const siteUrl = SITE_URL;

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
    },
  });

  if (error) return { error: error.message };
  redirect("/signup/check-email");
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function signInAction(
  _prev: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Incorrect email or password." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const next = (formData.get("next") as string) || null;
  redirect(next || (profile?.role === "admin" ? "/admin" : "/?login=success"));
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}

const emailSchema = z.string().email();

export type ResetRequestResult = { error: string | null; submitted: boolean };

export async function requestPasswordResetAction(
  _prev: ResetRequestResult,
  formData: FormData
): Promise<ResetRequestResult> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address.", submitted: false };

  const supabase = await createServerSupabaseClient();
  const siteUrl = SITE_URL;
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  // Always the same response, whether or not the email exists — avoids
  // leaking which addresses have accounts.
  return { error: null, submitted: true };
}

const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

export async function updatePasswordAction(
  _prev: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
