"use client";

import { useState, useTransition } from "react";
import { updateDiscountAction } from "@/lib/actions/admin-config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function DiscountRow({
  id,
  name,
  percentage,
  active,
  dict,
}: {
  id: string;
  name: string;
  percentage: number;
  active: boolean;
  dict: Dictionary;
}) {
  const [pct, setPct] = useState(String(percentage));
  const [isActive, setIsActive] = useState(active);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(nextActive = isActive) {
    startTransition(async () => {
      const result = await updateDiscountAction(id, Number(pct), nextActive);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        {saved && <p className="text-xs text-success">{dict.common.saved}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={(checked) => {
            setIsActive(checked);
            save(checked);
          }}
        />
        <Button size="sm" variant="outline" disabled={pending} onClick={() => save()}>
          {dict.common.save}
        </Button>
      </div>
    </li>
  );
}
