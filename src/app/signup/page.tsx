import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const dict = await getDictionary();
  return (
    <AuthShell title={dict.auth.signup.title} subtitle={dict.auth.signup.subtitle}>
      <SignupForm dict={dict} />
    </AuthShell>
  );
}
