"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionResult } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const initialState: AuthActionResult = { error: null };

export function SignupForm({ dict }: { dict: Dictionary }) {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="fullName">{dict.auth.signup.fullName}</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{dict.auth.signup.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">{dict.auth.signup.password}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <p className="text-xs text-muted-foreground">{dict.auth.signup.passwordHint}</p>
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="mt-1">
          {pending ? dict.auth.signup.submitting : dict.auth.signup.submit}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">{dict.auth.signup.or}</span>
        </div>
      </div>

      <GoogleSignInButton label={dict.auth.login.googleContinue} />

      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.signup.haveAccount}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {dict.auth.signup.signIn}
        </Link>
      </p>
    </div>
  );
}
