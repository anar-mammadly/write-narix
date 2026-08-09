import { AuthShell } from "@/components/auth/auth-shell";
import { MailCheck } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function CheckEmailPage() {
  const dict = await getDictionary();
  return (
    <AuthShell title={dict.auth.checkEmail.title}>
      <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
        <MailCheck className="size-8 text-success" />
        <p>{dict.auth.checkEmail.body}</p>
      </div>
    </AuthShell>
  );
}
