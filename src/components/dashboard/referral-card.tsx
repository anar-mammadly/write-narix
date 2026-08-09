"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";

export function ReferralCard({ code, dict }: { code: string; dict: Dictionary }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/signup?ref=${code}` : `/signup?ref=${code}`;

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-accent p-6">
      <p className="text-sm text-accent-foreground/80">{dict.dashboard.referral.yourCode}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-accent-foreground">{code || "—"}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? dict.dashboard.referral.copied : dict.dashboard.referral.copyLink}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigator.share?.({ title: "Narix Academy", url: link })}
        >
          <Share2 className="size-4" /> {dict.dashboard.referral.share}
        </Button>
      </div>
    </div>
  );
}
