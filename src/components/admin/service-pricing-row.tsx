"use client";

import { useState, useTransition } from "react";
import { updateServicePricingRuleAction, type ServicePricingPatch } from "@/lib/actions/admin-pricing";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Rule = {
  pricing_type: "progressive" | "per_page";
  base_pages: number | null;
  base_mode: "flat" | "linear" | null;
  base_price: number | null;
  additional_page_price: number | null;
  price_per_page: number | null;
  minimum_pages: number | null;
} | null;

export function ServicePricingRow({
  serviceId,
  serviceName,
  rule,
  dict,
}: {
  serviceId: string;
  serviceName: string;
  rule: Rule;
  dict: Dictionary;
}) {
  const [pricingType, setPricingType] = useState<"progressive" | "per_page">(rule?.pricing_type ?? "per_page");
  const [basePages, setBasePages] = useState(String(rule?.base_pages ?? 5));
  const [baseMode, setBaseMode] = useState<"flat" | "linear">(rule?.base_mode ?? "flat");
  const [basePrice, setBasePrice] = useState(String(rule?.base_price ?? 10));
  const [additionalPagePrice, setAdditionalPagePrice] = useState(String(rule?.additional_page_price ?? 1));
  const [pricePerPage, setPricePerPage] = useState(String(rule?.price_per_page ?? 10));
  const [minimumPages, setMinimumPages] = useState(String(rule?.minimum_pages ?? ""));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    const patch: ServicePricingPatch =
      pricingType === "progressive"
        ? {
            pricingType: "progressive",
            basePages: Number(basePages),
            baseMode,
            basePrice: Number(basePrice),
            additionalPagePrice: Number(additionalPagePrice),
          }
        : {
            pricingType: "per_page",
            pricePerPage: Number(pricePerPage),
            minimumPages: minimumPages.trim() === "" ? null : Number(minimumPages),
          };

    startTransition(async () => {
      const result = await updateServicePricingRuleAction(serviceId, patch);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      }
    });
  }

  return (
    <li className="grid gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{serviceName}</p>
        <Select items={{ progressive: "Progressive", per_page: "Per page" }} value={pricingType} onValueChange={(v) => v && setPricingType(v as "progressive" | "per_page")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="progressive">Progressive</SelectItem>
            <SelectItem value="per_page">Per page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pricingType === "progressive" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">First</span>
          <Input type="number" min="1" value={basePages} onChange={(e) => setBasePages(e.target.value)} className="w-16" />
          <span className="text-muted-foreground">pages:</span>
          <Select items={{ flat: "flat total", linear: "per page" }} value={baseMode} onValueChange={(v) => v && setBaseMode(v as "flat" | "linear")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">flat total</SelectItem>
              <SelectItem value="linear">per page</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" min="0" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="w-20" />
          <span className="text-muted-foreground">AZN, then +</span>
          <Input type="number" min="0" step="0.01" value={additionalPagePrice} onChange={(e) => setAdditionalPagePrice(e.target.value)} className="w-20" />
          <span className="text-muted-foreground">AZN/page after</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input type="number" min="0" step="0.01" value={pricePerPage} onChange={(e) => setPricePerPage(e.target.value)} className="w-20" />
          <span className="text-muted-foreground">AZN/page — minimum</span>
          <Input type="number" min="0" placeholder="none" value={minimumPages} onChange={(e) => setMinimumPages(e.target.value)} className="w-20" />
          <span className="text-muted-foreground">pages</span>
        </div>
      )}

      <div>
        <Button size="sm" variant="outline" disabled={pending} onClick={save}>
          {saved ? dict.common.saved : dict.common.save}
        </Button>
      </div>
    </li>
  );
}
