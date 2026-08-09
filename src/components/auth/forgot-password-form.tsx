"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type ResetRequestResult } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ResetRequestResult = { error: null, submitted: false };

export function ForgotPasswordForm({ dict }: { dict: Dictionary }) {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">{dict.auth.forgotPassword.email}</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? dict.auth.forgotPassword.submitting : dict.auth.forgotPassword.submit}
      </Button>
      {state.submitted && (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {dict.auth.forgotPassword.confirmation}
        </p>
      )}
    </form>
  );
}
