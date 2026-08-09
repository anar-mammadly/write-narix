"use client";

import { useState, useTransition } from "react";
import { approveReferralAction, rejectReferralAction } from "@/lib/actions/admin-referrals";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { formatMessage } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";

export function ReferralApprovalRow({
  id,
  code,
  referrerName,
  referredName,
  orderNumber,
  dict,
}: {
  id: string;
  code: string;
  referrerName: string;
  referredName: string;
  orderNumber: string;
  dict: Dictionary;
}) {
  const t = dict.admin.referrals;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div className="text-sm">
        <p className="font-medium text-foreground">{formatMessage(t.referredBy, { code, order: orderNumber })}</p>
        <p className="text-muted-foreground">{formatMessage(t.referredBody, { referrer: referrerName, referred: referredName })}</p>
        {error && <p className="text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await approveReferralAction(id);
              if (!result.ok) setError(result.error ?? "Failed");
              else setDone(true);
            })
          }
        >
          {t.approve}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await rejectReferralAction(id, "Not eligible");
              if (!result.ok) setError(result.error ?? "Failed");
              else setDone(true);
            })
          }
        >
          {t.reject}
        </Button>
      </div>
    </li>
  );
}
