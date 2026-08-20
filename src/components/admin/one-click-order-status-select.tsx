"use client";

import { useTransition } from "react";
import { updateOneClickOrderStatusAction, type OneClickOrderStatus } from "@/lib/actions/one-click-orders";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES: OneClickOrderStatus[] = ["new", "contacted", "converted", "cancelled"];

export function OneClickOrderStatusSelect({
  id,
  status,
  labels,
}: {
  id: string;
  status: OneClickOrderStatus;
  labels: Record<OneClickOrderStatus, string>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      items={Object.fromEntries(STATUSES.map((s) => [s, labels[s]]))}
      value={status}
      disabled={pending}
      onValueChange={(v) => {
        if (!v || v === status) return;
        startTransition(() => {
          updateOneClickOrderStatusAction(id, v as OneClickOrderStatus);
        });
      }}
    >
      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>{labels[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
