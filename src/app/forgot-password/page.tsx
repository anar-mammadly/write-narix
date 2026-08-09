import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const dict = await getDictionary();
  return (
    <AuthShell title={dict.auth.forgotPassword.title} subtitle={dict.auth.forgotPassword.subtitle}>
      <ForgotPasswordForm dict={dict} />
    </AuthShell>
  );
}
