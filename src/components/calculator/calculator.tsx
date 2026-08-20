"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import type { CalculatorConfig } from "@/lib/data/calculator-config";
import { previewPriceAction, type PricePreview } from "@/lib/actions/pricing";
import { createOrderAction } from "@/lib/actions/orders";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { formatMessage } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { InstitutionSelect } from "@/components/orders/institution-select";
import { AZERBAIJAN_UNIVERSITIES, AZERBAIJAN_COLLEGES } from "@/lib/data/institutions";

function PillGroup<T extends { id: string }>({
  items,
  value,
  onChange,
  label,
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  label: (item: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
            value === item.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-primary/50"
          )}
        >
          {label(item)}
        </button>
      ))}
    </div>
  );
}

export function Calculator({
  config,
  isAuthenticated,
  dict,
  specialPriceBanner,
}: {
  config: CalculatorConfig;
  isAuthenticated: boolean;
  dict: Dictionary;
  specialPriceBanner?: { text: string; amount: number; serviceIds: string[] } | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"configure" | "details">("configure");

  // Which deadlines a service offers, its default, and the surcharge % each
  // one carries all come from service_deadline_options — there is no
  // hardcoded "if dissertation" branch here, so any service admin sets up
  // with its own deadline table (90/60-day long-form services included)
  // is handled automatically.
  function deadlinesForService(sid: string) {
    return config.deadlineOptions
      .map((d) => {
        const row = config.serviceDeadlines.find((sd) => sd.service_id === sid && sd.deadline_option_id === d.id);
        return row ? { ...d, surcharge_percent: row.surcharge_percent, is_default: row.is_default } : null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }
  function defaultDeadlineFor(sid: string) {
    const options = deadlinesForService(sid);
    return options.find((d) => d.is_default)?.id ?? options[0]?.id ?? "";
  }

  const [serviceId, setServiceId] = useState(config.services[0]?.id ?? "");
  const [academicLevelId, setAcademicLevelId] = useState(config.academicLevels[0]?.id ?? "");
  const [deadlineOptionId, setDeadlineOptionId] = useState(() => defaultDeadlineFor(config.services[0]?.id ?? ""));
  const [languageId, setLanguageId] = useState(config.languages[0]?.id ?? "");
  const [citationStyleId, setCitationStyleId] = useState(config.citationStyles[0]?.id ?? "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState("");

  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showMinimumModal, setShowMinimumModal] = useState(false);

  const selectedService = useMemo(
    () => config.services.find((s) => s.id === serviceId),
    [config.services, serviceId]
  );
  const selectedRule = useMemo(
    () => config.pricingRules.find((r) => r.service_id === serviceId),
    [config.pricingRules, serviceId]
  );
  // The minimum-page requirement lives entirely in the database
  // (service_pricing_rules.minimum_pages) — there is no hardcoded
  // service-name lookup, so any service admin gives a minimum to is
  // enforced here automatically, Dissertation and Buraxılış İşi included.
  const minPages = selectedRule?.minimum_pages ?? 1;

  const [pageCountInput, setPageCountInput] = useState<string>(String(minPages));

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deadlinesForService is a pure function of config, recreated each render
  const availableDeadlines = useMemo(() => deadlinesForService(serviceId), [serviceId, config.deadlineOptions, config.serviceDeadlines]);

  // Switching to a service selects the new page-count minimum directly, and
  // resets the deadline to that service's own default (e.g. 90 gün for
  // Dissertation/Buraxılış İşi, 30 gün for everything else) — no effect
  // needed, this runs from the Select's own change handler.
  function handleServiceChange(nextServiceId: string) {
    setServiceId(nextServiceId);
    const nextMin = config.pricingRules.find((r) => r.service_id === nextServiceId)?.minimum_pages ?? 1;
    const current = Number(pageCountInput);
    if (!Number.isFinite(current) || current < nextMin) {
      setPageCountInput(String(nextMin));
    }
    setDeadlineOptionId(defaultDeadlineFor(nextServiceId));
  }

  const pageCount = Number(pageCountInput);
  const pageCountValid = Number.isInteger(pageCount) && pageCount >= 1;
  const belowMinimum = pageCountValid && pageCount < minPages;
  const canPreview = !!serviceId && !!academicLevelId && !!deadlineOptionId && pageCountValid && !belowMinimum;

  // The single gate for step 1 -> step 2. Deliberately NOT implemented as
  // just a `disabled` attribute on the Continue button: a disabled button
  // never fires onClick, so there would be no way to show the user *why*
  // they're stuck. Validation runs explicitly on click, blocks navigation
  // with an early `return` when it fails, and only then opens the modal —
  // so Dissertation and Buraxılış İşi (or any future service with a
  // minimum) behave identically here, driven by the same `minPages` value.
  function handleContinueClick() {
    if (belowMinimum) {
      setShowMinimumModal(true);
      return;
    }
    if (!pageCountValid || !displayPreview) {
      return;
    }
    setStep("details");
  }

  // Debounced, read-only preview call — every keystroke/selection triggers
  // this, but nothing here writes to the database (see previewPriceAction).
  useEffect(() => {
    if (!canPreview) {
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await previewPriceAction({
          serviceId,
          academicLevelId,
          deadlineOptionId,
          wordCount: null,
          pageCount,
          languageId: languageId || null,
          citationStyleId: citationStyleId || null,
          additionalServiceIds: addonIds,
          promoCode: promoCode || null,
        });
        setPreview(result.data);
        setPreviewError(result.error);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [canPreview, serviceId, academicLevelId, deadlineOptionId, pageCount, languageId, citationStyleId, addonIds, promoCode]);

  const displayPreview = canPreview ? preview : null;

  function toggleAddon(id: string) {
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      {step === "configure" ? (
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-7">
            <div className="grid gap-2.5">
              <Label>{dict.calculator.service}</Label>
              <Select
                items={Object.fromEntries(config.services.map((s) => [s.id, s.name]))}
                value={serviceId}
                onValueChange={(v) => v && handleServiceChange(v)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder={dict.calculator.servicePlaceholder} /></SelectTrigger>
                <SelectContent>
                  {config.services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2.5">
              <Label>{dict.calculator.academicLevel}</Label>
              <PillGroup items={config.academicLevels} value={academicLevelId} onChange={setAcademicLevelId} label={(l) => l.name} />
            </div>

            <div className="grid gap-2.5">
              <Label>{dict.calculator.deadline}</Label>
              <PillGroup
                items={availableDeadlines}
                value={deadlineOptionId}
                onChange={setDeadlineOptionId}
                label={(d) => (d.surcharge_percent > 0 ? formatMessage(dict.calculator.deadlineSurchargeLabel, { label: d.label, pct: d.surcharge_percent }) : d.label)}
              />
            </div>

            <div className="grid gap-2.5">
              <Label htmlFor="pageCount">{dict.calculator.pageCount}</Label>
              <Input
                id="pageCount"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={pageCountInput}
                onChange={(e) => setPageCountInput(e.target.value)}
                className="max-w-[140px]"
              />
              {!pageCountValid ? (
                <p className="text-xs text-destructive">{dict.calculator.invalidPageCount}</p>
              ) : belowMinimum ? (
                <p className="text-xs text-destructive">{formatMessage(dict.calculator.minimumPagesNotice, { min: minPages })}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{dict.calculator.pageCountHint}</p>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="grid gap-2.5">
                <Label>{dict.calculator.language}</Label>
                <Select
                  items={Object.fromEntries(config.languages.map((l) => [l.id, l.name]))}
                  value={languageId}
                  onValueChange={(v) => setLanguageId(v ?? "")}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {config.languages.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2.5">
                <Label>{dict.calculator.citationStyle}</Label>
                <Select
                  items={Object.fromEntries(config.citationStyles.map((c) => [c.id, c.name]))}
                  value={citationStyleId}
                  onValueChange={(v) => setCitationStyleId(v ?? "")}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {config.citationStyles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {config.additionalServices.length > 0 && (
              <div className="grid gap-2.5">
                <Label>{dict.calculator.additionalServices}</Label>
                <div className="grid gap-2">
                  {config.additionalServices.map((a) => {
                    const computed = displayPreview?.addons_breakdown.find((b) => b.id === a.id);
                    return (
                      <label key={a.id} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50">
                        <Checkbox className="mt-0.5" checked={addonIds.includes(a.id)} onCheckedChange={() => toggleAddon(a.id)} />
                        <span className="flex-1">
                          <span className="block">{a.name}</span>
                          {a.is_plagiarism_addon && (
                            <span className="block text-xs text-muted-foreground">{dict.calculator.plagiarismHint}</span>
                          )}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {a.is_plagiarism_addon
                            ? addonIds.includes(a.id) && computed
                              ? computed.computed_price === 0
                                ? dict.calculator.plagiarismFree
                                : `+${computed.computed_price.toFixed(2)} AZN`
                              : ""
                            : a.price_type === "fixed"
                            ? `+${a.price_value} AZN`
                            : `+${a.price_value}%`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-2.5">
              <Label htmlFor="promo">{dict.calculator.promoCode}</Label>
              <Input id="promo" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" className="max-w-xs" />
            </div>
          </div>

          <PricePanel
            preview={displayPreview}
            error={previewError}
            isPending={isPending}
            isAuthenticated={isAuthenticated}
            dict={dict}
            onContinue={handleContinueClick}
            canContinue={pageCountValid}
            specialPriceBanner={specialPriceBanner?.serviceIds.includes(serviceId) ? specialPriceBanner : null}
          />
        </div>
      ) : (
        <OrderDetailsStep
          isAuthenticated={isAuthenticated}
          preview={displayPreview}
          dict={dict}
          specialPriceBanner={specialPriceBanner?.serviceIds.includes(serviceId) ? specialPriceBanner : null}
          selection={{
            serviceId,
            academicLevelId,
            deadlineOptionId,
            wordCount: null,
            pageCount,
            languageId: languageId || null,
            citationStyleId: citationStyleId || null,
            additionalServiceIds: addonIds,
            promoCode: promoCode || null,
          }}
          onBack={() => setStep("configure")}
          onSuccess={(orderNumber, token, referralStatus, promoStatus) => {
            const params = new URLSearchParams();
            if (token) params.set("token", token);
            if (referralStatus) params.set("referral", referralStatus);
            if (promoStatus) params.set("promo", promoStatus);
            const q = params.toString();
            router.push(`/order-confirmation/${orderNumber}${q ? `?${q}` : ""}`);
          }}
        />
      )}

      <Dialog open={showMinimumModal} onOpenChange={setShowMinimumModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formatMessage(dict.calculator.minimumModalTitle, { min: minPages })}</DialogTitle>
            <DialogDescription>
              {formatMessage(dict.calculator.minimumModalBody, { service: selectedService?.name ?? "", min: minPages })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowMinimumModal(false)}>{dict.calculator.minimumModalButton}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PricePanel({
  preview,
  error,
  isPending,
  isAuthenticated,
  dict,
  onContinue,
  canContinue,
  specialPriceBanner,
}: {
  preview: PricePreview | null;
  error: string | null;
  isPending: boolean;
  isAuthenticated: boolean;
  dict: Dictionary;
  onContinue: () => void;
  canContinue: boolean;
  specialPriceBanner?: { text: string; amount: number; serviceIds: string[] } | null;
}) {
  return (
    <div className="lg:sticky lg:top-24 rounded-xl border border-border bg-muted/40 p-6 h-fit">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        {dict.calculator.yourPrice}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        {preview ? (
          <>
            <span className="font-heading text-4xl font-semibold text-foreground">
              {preview.final_price.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">{dict.common.currency}</span>
          </>
        ) : (
          <span className="font-heading text-4xl font-semibold text-muted-foreground/40">—</span>
        )}
        {isPending && <Loader2 className="ml-2 size-4 animate-spin text-muted-foreground" />}
      </div>

      {specialPriceBanner && preview && preview.final_price > specialPriceBanner.amount && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          {specialPriceBanner.text
            ? formatMessage(dict.calculator.specialPriceBanner, {
                text: specialPriceBanner.text,
                amount: specialPriceBanner.amount,
              })
            : formatMessage(dict.calculator.specialPriceBannerAmountOnly, {
                amount: specialPriceBanner.amount,
              })}
        </div>
      )}

      {preview && preview.applied && (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="size-4" />
          {formatMessage(dict.calculator.discountApplied, { name: dict.discountSources[preview.applied.source], pct: preview.applied.percentage })}
        </div>
      )}

      {preview && preview.candidates.length > 1 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {preview.candidates
            .filter((c) => c !== preview.applied)
            .map((c) => (
              <li key={c.source}>
                {formatMessage(dict.calculator.discountNotApplied, { name: dict.discountSources[c.source], pct: c.percentage })}
              </li>
            ))}
        </ul>
      )}

      {preview && preview.addons_breakdown.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-foreground">
          {preview.addons_breakdown.map((a) => (
            <li key={a.id} className="flex items-center justify-between">
              <span>{a.name}</span>
              <span className={a.computed_price === 0 && a.is_plagiarism_addon ? "text-success" : ""}>
                {a.computed_price === 0 && a.is_plagiarism_addon ? dict.calculator.plagiarismFree : `+${a.computed_price.toFixed(2)} AZN`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {preview && preview.deadline_surcharge_amount > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-foreground">
          <span>{formatMessage(dict.calculator.deadlineSurcharge, { pct: preview.deadline_surcharge_percent })}</span>
          <span>+{preview.deadline_surcharge_amount.toFixed(2)} AZN</span>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {!isAuthenticated && (
        <p className="mt-4 text-xs text-muted-foreground">
          {dict.calculator.memberHint}
        </p>
      )}

      <Button className="mt-5 w-full" size="lg" disabled={!canContinue} onClick={onContinue}>
        {dict.calculator.continue}
      </Button>
    </div>
  );
}

function OrderDetailsStep({
  isAuthenticated,
  preview,
  selection,
  dict,
  specialPriceBanner,
  onBack,
  onSuccess,
}: {
  isAuthenticated: boolean;
  preview: PricePreview | null;
  selection: Parameters<typeof previewPriceAction>[0];
  dict: Dictionary;
  specialPriceBanner?: { text: string; amount: number; serviceIds: string[] } | null;
  onBack: () => void;
  onSuccess: (orderNumber: string, token: string | null, referralStatus: string | null, promoStatus: string | null) => void;
}) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [university, setUniversity] = useState("");
  const [college, setCollege] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSubmit(async () => {
      const result = await createOrderAction({
        ...selection,
        subject,
        topic,
        description,
        university: university || null,
        college: college || null,
        guestName: isAuthenticated ? undefined : `${guestFirstName} ${guestLastName}`.trim(),
        guestEmail: isAuthenticated ? undefined : guestEmail,
        guestPhone: isAuthenticated ? undefined : guestPhone,
        referralCode: referralCode || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess(result.orderNumber, result.guestToken, result.referralStatus, result.promoStatus);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-5">
        <div className="grid gap-2.5">
          <Label htmlFor="subject">{dict.orderDetails.subject}</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="grid gap-2.5">
          <Label htmlFor="topic">{dict.orderDetails.topic}</Label>
          <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} required />
        </div>
        <div className="grid gap-2.5">
          <Label htmlFor="description">{dict.orderDetails.instructions}</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <InstitutionSelect
            id="university"
            label={dict.orderDetails.university}
            options={AZERBAIJAN_UNIVERSITIES}
            value={university}
            onChange={setUniversity}
            placeholder={formatMessage(dict.orderDetails.selectPlaceholder, { label: dict.orderDetails.university })}
            otherLabel={dict.orderDetails.otherOption}
            otherPlaceholder={formatMessage(dict.orderDetails.otherPlaceholder, { label: dict.orderDetails.university })}
          />
          <InstitutionSelect
            id="college"
            label={dict.orderDetails.college}
            options={AZERBAIJAN_COLLEGES}
            value={college}
            onChange={setCollege}
            placeholder={formatMessage(dict.orderDetails.selectPlaceholder, { label: dict.orderDetails.college })}
            otherLabel={dict.orderDetails.otherOption}
            otherPlaceholder={formatMessage(dict.orderDetails.otherPlaceholder, { label: dict.orderDetails.college })}
          />
        </div>

        {!isAuthenticated && (
          <div className="grid gap-4 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">{dict.orderDetails.guestSectionTitle}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2.5">
                <Label htmlFor="guestFirstName">{dict.orderDetails.firstName}</Label>
                <Input id="guestFirstName" value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} required />
              </div>
              <div className="grid gap-2.5">
                <Label htmlFor="guestLastName">{dict.orderDetails.lastName}</Label>
                <Input id="guestLastName" value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} required />
              </div>
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="guestEmail">{dict.orderDetails.email}</Label>
              <Input id="guestEmail" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="guestPhone">{dict.orderDetails.phone}</Label>
              <Input id="guestPhone" type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required />
            </div>
          </div>
        )}

        {isAuthenticated && (
          <div className="grid gap-2.5">
            <Label htmlFor="referralCode">{dict.orderDetails.referralCode}</Label>
            <Input id="referralCode" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} placeholder="NARIX-ABC123" className="max-w-xs" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack}>{dict.common.back}</Button>
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? dict.calculator.submitting : formatMessage(dict.calculator.placeOrder, { price: preview?.final_price.toFixed(2) ?? "—" })}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-6 h-fit text-sm">
        <p className="font-medium text-foreground">{dict.calculator.orderSummary}</p>

        {specialPriceBanner && preview && preview.final_price > specialPriceBanner.amount && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            {specialPriceBanner.text
              ? formatMessage(dict.calculator.specialPriceBanner, {
                  text: specialPriceBanner.text,
                  amount: specialPriceBanner.amount,
                })
              : formatMessage(dict.calculator.specialPriceBannerAmountOnly, {
                  amount: specialPriceBanner.amount,
                })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-muted-foreground">{dict.calculator.service}</span>
          <span>{preview?.base_price.toFixed(2) ?? "—"} {dict.common.currency}</span>
        </div>

        {preview?.addons_breakdown.map((a) => (
          <div key={a.id} className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">{a.name}</span>
            <span className={a.computed_price === 0 && a.is_plagiarism_addon ? "text-success" : ""}>
              {a.computed_price === 0 && a.is_plagiarism_addon ? dict.calculator.plagiarismFree : `${a.computed_price.toFixed(2)} ${dict.common.currency}`}
            </span>
          </div>
        ))}

        {preview && preview.deadline_surcharge_amount > 0 && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">{formatMessage(dict.calculator.deadlineSurcharge, { pct: preview.deadline_surcharge_percent })}</span>
            <span>{preview.deadline_surcharge_amount.toFixed(2)} {dict.common.currency}</span>
          </div>
        )}

        <div className="mt-3 flex items-baseline gap-1 border-t border-border pt-3">
          <span className="font-heading text-3xl font-semibold">{preview?.final_price.toFixed(2) ?? "—"}</span>
          <span className="text-muted-foreground">{dict.common.currency}</span>
        </div>
        {preview?.applied && (
          <p className="mt-2 text-success">{formatMessage(dict.calculator.discountApplied, { name: dict.discountSources[preview.applied.source], pct: preview.applied.percentage })}</p>
        )}
      </div>
    </form>
  );
}
