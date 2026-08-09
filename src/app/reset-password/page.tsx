import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = { title: "Set new password" };

export default async function ResetPasswordPage() {
  const dict = await getDictionary();
  return (
    <AuthShell title={dict.auth.resetPassword.title}>
      <ResetPasswordForm dict={dict} />
    </AuthShell>
  );
}
