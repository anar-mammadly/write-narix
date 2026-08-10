"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PromoPopupConfig } from "@/lib/data/site-settings";

const DISMISSED_KEY = "narix_promo_popup_dismissed";

export function PromoPopup({ popup, closeLabel }: { popup: PromoPopupConfig; closeLabel: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // sessionStorage, not localStorage: dismissal should hold for the rest
    // of this browsing session (and survive client-side navigation, which
    // doesn't remount this component anyway) but show again on a fresh
    // visit later, matching "respect dismissal during current session".
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberately closed during SSR/first paint, revealed only after mount to avoid a hydration mismatch
    setOpen(true);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {popup.title && <DialogTitle className="font-heading text-xl">{popup.title}</DialogTitle>}
          {popup.description && <DialogDescription className="text-sm">{popup.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="sm:justify-between sm:flex-row-reverse">
          {popup.ctaText && (
            <Button
              onClick={() => {
                dismiss();
                document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {popup.ctaText}
            </Button>
          )}
          <Button variant="outline" onClick={dismiss}>
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
