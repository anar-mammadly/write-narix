"use client";

import { useState, useTransition } from "react";
import { toggleOrderStatusActiveAction } from "@/lib/actions/admin-config";
import { Switch } from "@/components/ui/switch";

export function StatusActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [checked, setChecked] = useState(active);
  const [, startTransition] = useTransition();

  return (
    <Switch
      checked={checked}
      onCheckedChange={(v) => {
        setChecked(v);
        startTransition(() => { toggleOrderStatusActiveAction(id, v); });
      }}
    />
  );
}
