"use client";

import { useState, useTransition } from "react";
import { createOrderStatusAction } from "@/lib/actions/admin-config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StatusCreateForm({ nextOrder, dict }: { nextOrder: number; dict: Dictionary }) {
  const t = dict.admin.statuses;
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2A5CAA");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
      <div className="grid gap-1.5">
        <label className="text-xs text-muted-foreground">{t.addTitle}</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.addPlaceholder} className="w-56" />
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs text-muted-foreground">{t.color}</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 rounded-md border border-border" />
      </div>
      <Button
        size="sm"
        disabled={pending || !name}
        onClick={() =>
          startTransition(async () => {
            const result = await createOrderStatusAction(name, color, nextOrder);
            if (result.ok) setName("");
          })
        }
      >
        {t.addButton}
      </Button>
    </div>
  );
}
