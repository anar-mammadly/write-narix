import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyOtpForm } from "@/components/auth/verify-otp-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifySignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  if (!email) redirect("/signup");

  const dict = await getDictionary();
  return (
    <AuthShell
      title={dict.auth.verifyOtp.title}
      subtitle={dict.auth.verifyOtp.subtitle.replace("{email}", email)}
    >
      <VerifyOtpForm dict={dict} email={email} />
    </AuthShell>
  );
}
