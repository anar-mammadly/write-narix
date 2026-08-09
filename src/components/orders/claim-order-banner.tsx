"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { claimGuestOrderAction } from "@/lib/actions/claim";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";

export function ClaimOrderBanner({
  orderNumber,
  token,
  dict,
}: {
  orderNumber: string;
  token: string;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  function handleClaim() {
    setError(null);
    startTransition(async () => {
      const result = await claimGuestOrderAction(orderNumber, token);
      if (!result.ok) {
        if (result.error === "AUTH_REQUIRED") setNeedsAuth(true);
        else setError(result.error);
        return;
      }
      router.push("/dashboard/orders");
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-primary/20 bg-accent p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-accent-foreground">{dict.track.claimPrompt}</p>
      {needsAuth ? (
        <Button size="sm" render={<Link href={`/signup?next=/track/${token}`} />}>{dict.track.signUp}</Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleClaim} disabled={pending}>
            {pending ? dict.track.claimLinking : dict.track.claimButton}
          </Button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      )}
    </div>
  );
}
