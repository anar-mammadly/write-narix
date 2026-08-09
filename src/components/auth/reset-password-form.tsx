"use client";

import { useActionState } from "react";
import { updatePasswordAction, type AuthActionResult } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionResult = { error: null };

export function ResetPasswordForm({ dict }: { dict: Dictionary }) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="password">{dict.auth.resetPassword.password}</Label>
        <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? dict.auth.resetPassword.submitting : dict.auth.resetPassword.submit}
      </Button>
    </form>
  );
}
