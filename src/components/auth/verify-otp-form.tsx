"use client";

import { useActionState } from "react";
import {
  verifySignupOtpAction,
  resendSignupOtpAction,
  type AuthActionResult,
  type ResendOtpResult,
} from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialVerifyState: AuthActionResult = { error: null };
const initialResendState: ResendOtpResult = { error: null, sent: false };

export function VerifyOtpForm({ dict, email }: { dict: Dictionary; email: string }) {
  const [state, formAction, pending] = useActionState(verifySignupOtpAction, initialVerifyState);
  const [resendState, resendAction, resendPending] = useActionState(resendSignupOtpAction, initialResendState);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="email" value={email} />
        <div className="grid gap-1.5">
          <Label htmlFor="token">{dict.auth.verifyOtp.codeLabel}</Label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            minLength={6}
            pattern="[0-9]{6}"
            placeholder="000000"
            className="text-center text-lg tracking-[0.5em]"
            required
            autoFocus
          />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="mt-1">
          {pending ? dict.auth.verifyOtp.submitting : dict.auth.verifyOtp.submit}
        </Button>
      </form>

      <form action={resendAction} className="grid gap-2 text-center">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={resendPending}
          className="text-sm text-primary hover:underline disabled:opacity-60"
        >
          {resendPending ? dict.auth.verifyOtp.resending : dict.auth.verifyOtp.resend}
        </button>
        {resendState.sent && (
          <p className="text-xs text-success" aria-live="polite">
            {dict.auth.verifyOtp.resent}
          </p>
        )}
        {resendState.error && (
          <p className="text-xs text-destructive" aria-live="polite">
            {resendState.error}
          </p>
        )}
      </form>
    </div>
  );
}
