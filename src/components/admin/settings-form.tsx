"use client";

import { useState, useTransition } from "react";
import { updateSiteSettingAction } from "@/lib/actions/admin-config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function WhatsAppSettingsForm({ number, display, dict }: { number: string; display: string; dict: Dictionary }) {
  const t = dict.admin.settings;
  const [num, setNum] = useState(number);
  const [disp, setDisp] = useState(display);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">{t.whatsappTitle}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t.whatsappNumber}</Label>
          <Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="994515600625" />
        </div>
        <div className="grid gap-1.5">
          <Label>{t.whatsappDisplay}</Label>
          <Input value={disp} onChange={(e) => setDisp(e.target.value)} placeholder="051-560-06-25" />
        </div>
      </div>
      {saved && <p className="text-xs text-success">{dict.common.saved}</p>}
      <Button
        size="sm"
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await updateSiteSettingAction("whatsapp", { number: num, display: disp });
            if (result.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
          })
        }
      >
        {dict.common.save}
      </Button>
    </div>
  );
}

export function EarlyOrderBannerForm({
  enabled,
  text,
  textEn,
  dict,
}: {
  enabled: boolean;
  text: string;
  textEn: string;
  dict: Dictionary;
}) {
  const t = dict.admin.settings;
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [bannerText, setBannerText] = useState(text);
  const [bannerTextEn, setBannerTextEn] = useState(textEn);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await updateSiteSettingAction("early_order_banner", {
        enabled: isEnabled,
        text: bannerText,
        text_en: bannerTextEn,
      });
      if (result.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
    });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{t.bannerTitle}</p>
        <Switch
          checked={isEnabled}
          onCheckedChange={(v) => {
            setIsEnabled(v);
            startTransition(() => {
              updateSiteSettingAction("early_order_banner", { enabled: v, text: bannerText, text_en: bannerTextEn });
            });
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.bannerTextAz}</Label>
        <Input value={bannerText} onChange={(e) => setBannerText(e.target.value)} placeholder={t.bannerPlaceholder} />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.bannerTextEn}</Label>
        <Input value={bannerTextEn} onChange={(e) => setBannerTextEn(e.target.value)} placeholder={t.bannerPlaceholderEn} />
      </div>
      {saved && <p className="text-xs text-success">{dict.common.saved}</p>}
      <Button size="sm" className="w-fit" disabled={pending} onClick={save}>{dict.common.save}</Button>
    </div>
  );
}

export function ReferralValidityForm({ validityDays, dict }: { validityDays: number; dict: Dictionary }) {
  const t = dict.admin.settings;
  const [days, setDays] = useState(String(validityDays));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">{t.referralValidityTitle}</p>
      <div className="flex items-center gap-2">
        <Input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} className="w-24" />
        <span className="text-sm text-muted-foreground">{t.referralValidityDays}</span>
      </div>
      {saved && <p className="text-xs text-success">{dict.common.saved}</p>}
      <Button
        size="sm"
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await updateSiteSettingAction("referral_program", { validity_days: Number(days), max_uses_per_code: 3 });
            if (result.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
          })
        }
      >
        {dict.common.save}
      </Button>
    </div>
  );
}
