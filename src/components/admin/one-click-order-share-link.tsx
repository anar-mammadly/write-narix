"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OneClickOrderShareLink({
  helpText,
  copyLabel,
  copiedLabel,
}: {
  helpText: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/?order=1` : "/?order=1";

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <p className="flex-1 text-sm text-muted-foreground">{helpText}</p>
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  );
}
