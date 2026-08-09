"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTHER_INSTITUTION_VALUE } from "@/lib/data/institutions";

export function InstitutionSelect({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  otherLabel = "Other (type manually)",
  otherPlaceholder = "Type it manually",
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
}) {
  const isKnownOption = options.includes(value);
  const [mode, setMode] = useState<"list" | "other">(value && !isKnownOption ? "other" : "list");
  const selectValue = mode === "other" ? OTHER_INSTITUTION_VALUE : value;

  const items: Record<string, string> = {
    [OTHER_INSTITUTION_VALUE]: otherLabel,
    ...Object.fromEntries(options.map((o) => [o, o])),
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={selectValue}
        onValueChange={(v) => {
          if (!v) return;
          if (v === OTHER_INSTITUTION_VALUE) {
            setMode("other");
            onChange("");
          } else {
            setMode("list");
            onChange(v);
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder ?? label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={OTHER_INSTITUTION_VALUE}>{otherLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mode === "other" && (
        <Input
          placeholder={otherPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
