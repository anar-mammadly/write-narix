"use client";

import { useState, useTransition } from "react";
import { updateSiteSettingAction } from "@/lib/actions/admin-config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

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

export function SpecialPriceBannerForm({
  enabled,
  text,
  textEn,
  amount,
  serviceIds,
  services,
  dict,
}: {
  enabled: boolean;
  text: string;
  textEn: string;
  amount: number;
  serviceIds: string[];
  services: { id: string; name: string }[];
  dict: Dictionary;
}) {
  const t = dict.admin.settings;
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [bannerText, setBannerText] = useState(text);
  const [bannerTextEn, setBannerTextEn] = useState(textEn);
  const [bannerAmount, setBannerAmount] = useState(String(amount || ""));
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(serviceIds);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function payload(overrides: Partial<{ enabled: boolean }> = {}) {
    return {
      enabled: overrides.enabled ?? isEnabled,
      text: bannerText,
      text_en: bannerTextEn,
      amount: Number(bannerAmount) || 0,
      service_ids: selectedServiceIds,
    };
  }

  function save() {
    startTransition(async () => {
      const result = await updateSiteSettingAction("special_price_banner", payload());
      if (result.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
    });
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{t.specialPriceBannerTitle}</p>
        <Switch
          checked={isEnabled}
          onCheckedChange={(v) => {
            setIsEnabled(v);
            startTransition(() => { updateSiteSettingAction("special_price_banner", payload({ enabled: v })); });
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t.specialPriceBannerTextAz}</Label>
          <Input value={bannerText} onChange={(e) => setBannerText(e.target.value)} placeholder={t.specialPriceBannerPlaceholder} />
        </div>
        <div className="grid gap-1.5">
          <Label>{t.specialPriceBannerTextEn}</Label>
          <Input value={bannerTextEn} onChange={(e) => setBannerTextEn(e.target.value)} placeholder={t.specialPriceBannerPlaceholderEn} />
        </div>
      </div>
      <div className="grid gap-1.5 max-w-[160px]">
        <Label>{t.specialPriceBannerAmount}</Label>
        <Input type="number" min="0" step="0.01" value={bannerAmount} onChange={(e) => setBannerAmount(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.specialPriceBannerServices}</Label>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
              <Checkbox checked={selectedServiceIds.includes(s.id)} onCheckedChange={() => toggleService(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
        {selectedServiceIds.length === 0 && (
          <p className="text-xs text-muted-foreground">{t.specialPriceBannerNoServiceHint}</p>
        )}
      </div>
      {saved && <p className="text-xs text-success">{dict.common.saved}</p>}
      <Button size="sm" className="w-fit" disabled={pending} onClick={save}>{dict.common.save}</Button>
    </div>
  );
}

export function PromoPopupForm({
  enabled,
  title,
  titleEn,
  description,
  descriptionEn,
  ctaText,
  ctaTextEn,
  startDate,
  endDate,
  dict,
}: {
  enabled: boolean;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  ctaText: string;
  ctaTextEn: string;
  startDate: string;
  endDate: string;
  dict: Dictionary;
}) {
  const t = dict.admin.settings;
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [titleAz, setTitleAz] = useState(title);
  const [titleEnVal, setTitleEnVal] = useState(titleEn);
  const [descAz, setDescAz] = useState(description);
  const [descEn, setDescEn] = useState(descriptionEn);
  const [ctaAz, setCtaAz] = useState(ctaText);
  const [ctaEn, setCtaEn] = useState(ctaTextEn);
  const [start, setStart] = useState(startDate.slice(0, 10));
  const [end, setEnd] = useState(endDate.slice(0, 10));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function payload(overrides: Partial<{ enabled: boolean }> = {}) {
    return {
      enabled: overrides.enabled ?? isEnabled,
      title: titleAz,
      title_en: titleEnVal,
      description: descAz,
      description_en: descEn,
      cta_text: ctaAz,
      cta_text_en: ctaEn,
      start_date: start || null,
      end_date: end || null,
    };
  }

  function save() {
    startTransition(async () => {
      const result = await updateSiteSettingAction("promo_popup", payload());
      if (result.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
    });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{t.promoPopupTitle}</p>
        <Switch
          checked={isEnabled}
          onCheckedChange={(v) => {
            setIsEnabled(v);
            startTransition(() => { updateSiteSettingAction("promo_popup", payload({ enabled: v })); });
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t.promoPopupHeadingAz}</Label>
          <Input value={titleAz} onChange={(e) => setTitleAz(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>{t.promoPopupHeadingEn}</Label>
          <Input value={titleEnVal} onChange={(e) => setTitleEnVal(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t.promoPopupBodyAz}</Label>
          <Textarea value={descAz} onChange={(e) => setDescAz(e.target.value)} rows={3} />
        </div>
        <div className="grid gap-1.5">
          <Label>{t.promoPopupBodyEn}</Label>
          <Textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={3} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t.promoPopupCtaAz}</Label>
          <Input value={ctaAz} onChange={(e) => setCtaAz(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>{t.promoPopupCtaEn}</Label>
          <Input value={ctaEn} onChange={(e) => setCtaEn(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t.promoPopupStart}</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>{t.promoPopupEnd}</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
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
