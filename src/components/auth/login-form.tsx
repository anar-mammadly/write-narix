"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInAction, type AuthActionResult } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const initialState: AuthActionResult = { error: null };

export function LoginForm({ dict }: { dict: Dictionary }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-1.5">
          <Label htmlFor="email">{dict.auth.login.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{dict.auth.login.password}</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
              {dict.auth.login.forgotPassword}
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="mt-1">
          {pending ? dict.auth.login.submitting : dict.auth.login.submit}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">{dict.auth.login.or}</span>
        </div>
      </div>

      <GoogleSignInButton next={next} label={dict.auth.login.googleContinue} />

      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.login.noAccount}{" "}
        <Link href="/signup" className="text-primary hover:underline">
          {dict.auth.login.createOne}
        </Link>
      </p>
    </div>
  );
}
