"use client";

import { useTransition } from "react";
import { markNotificationsReadAction } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkNotificationsRead({ ids, label = "Mark all as read" }: { ids: string[]; label?: string }) {
  const [pending, startTransition] = useTransition();
  if (ids.length === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => markNotificationsReadAction(ids))}
    >
      {label}
    </Button>
  );
}
