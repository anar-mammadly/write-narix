"use client";

import { useState, useTransition } from "react";
import { approvePromoRequestAction, rejectPromoRequestAction } from "@/lib/actions/admin-referrals";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { formatMessage } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PromoRequestApprovalRow({
  id,
  code,
  customerName,
  orderNumber,
  dict,
}: {
  id: string;
  code: string;
  customerName: string;
  orderNumber: string;
  dict: Dictionary;
}) {
  const t = dict.admin.referrals;
  const [pct, setPct] = useState("10");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  const pctValid = pct.trim() !== "" && Number(pct) >= 0 && Number(pct) <= 100;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div className="text-sm">
        <p className="font-medium text-foreground">{formatMessage(t.promoUsedBy, { code, order: orderNumber })}</p>
        <p className="text-muted-foreground">{customerName}</p>
        {error && <p className="text-destructive">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="w-20"
            aria-label={t.discountPercentage}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <Button
          size="sm"
          disabled={pending || !pctValid}
          onClick={() =>
            startTransition(async () => {
              const result = await approvePromoRequestAction(id, Number(pct));
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
              const result = await rejectPromoRequestAction(id, "Not eligible");
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
