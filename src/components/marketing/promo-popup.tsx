"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Gift } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PromoPopupConfig } from "@/lib/data/site-settings";

const DISMISSED_KEY = "narix_promo_popup_dismissed";

// Highlights the literal words "PULSUZ"/"FREE" (any case) inside the
// admin-edited promo text — a deliberate, eye-catching exception to the
// site's muted palette, scoped to just this word rather than a full
// markdown system. A capturing group makes String.split() interleave the
// matches into the result at every odd index, so no separate stateful
// regex test is needed to tell them apart.
function renderWithHighlight(text: string): ReactNode[] {
  const parts = text.split(/(pulsuz|free)/gi);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-bold text-[#DC2626]">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

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
      <DialogContent className="overflow-hidden sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
            <Gift className="size-6" />
          </span>
          {popup.title && (
            <DialogTitle className="font-heading text-2xl font-semibold">{popup.title}</DialogTitle>
          )}
          {popup.description && (
            <DialogDescription className="text-[0.95rem] leading-relaxed text-foreground/80">
              {renderWithHighlight(popup.description)}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Explicit vertical stack — deliberately not DialogFooter's
            flex-col-reverse (which, combined with a justify override, was
            letting the two buttons render on top of each other on mobile). */}
        <div className="-mx-4 -mb-4 flex flex-col gap-2 rounded-b-xl border-t border-border bg-muted/50 p-4">
          {popup.ctaText && (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                dismiss();
                document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {popup.ctaText}
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={dismiss}>
            {closeLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
