import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const dict = await getDictionary();
  return (
    <AuthShell title={dict.auth.login.title} subtitle={dict.auth.login.subtitle}>
      <Suspense>
        <LoginForm dict={dict} />
      </Suspense>
    </AuthShell>
  );
}
