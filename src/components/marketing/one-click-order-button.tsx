"use client";

import { useState, useTransition } from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { createOneClickOrderAction } from "@/lib/actions/one-click-orders";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

type Service = { id: string; name: string };

export function OneClickOrderButton({
  services,
  isAuthenticated,
  dict,
}: {
  services: Service[];
  isAuthenticated: boolean;
  dict: Dictionary;
}) {
  const t = dict.oneClickOrder;
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [topic, setTopic] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const errorMessages: Record<string, string> = {
    topicRequired: t.errorTopicRequired,
    serviceRequired: t.errorServiceRequired,
    phoneRequired: t.errorPhoneRequired,
    emailRequired: t.errorEmailRequired,
    generic: t.errorGeneric,
  };

  function reset() {
    setServiceId("");
    setTopic("");
    setPhone("");
    setEmail("");
    setError(null);
    setSuccess(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSubmit(async () => {
      const result = await createOneClickOrderAction({
        serviceId,
        topic,
        phone: isAuthenticated ? undefined : phone,
        email: isAuthenticated ? undefined : email,
      });
      if (!result.ok) {
        setError(errorMessages[result.error] ?? t.errorGeneric);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <>
      <Button size="lg" className="gap-2" onClick={() => setOpen(true)}>
        <Zap className="size-4" />
        {t.button}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          {success ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-success" />
                  {t.successTitle}
                </DialogTitle>
                <DialogDescription>{t.successBody}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>{t.close}</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{t.title}</DialogTitle>
                <DialogDescription>{t.description}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2.5">
                  <Label>{t.service}</Label>
                  <Select
                    items={Object.fromEntries(services.map((s) => [s.id, s.name]))}
                    value={serviceId}
                    onValueChange={(v) => v && setServiceId(v)}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder={t.servicePlaceholder} /></SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2.5">
                  <Label htmlFor="oneClickTopic">{t.topic}</Label>
                  <Input
                    id="oneClickTopic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t.topicPlaceholder}
                    required
                  />
                </div>

                {!isAuthenticated && (
                  <>
                    <div className="grid gap-2.5">
                      <Label htmlFor="oneClickPhone">{t.phone}</Label>
                      <Input
                        id="oneClickPhone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t.phonePlaceholder}
                        required
                      />
                    </div>
                    <div className="grid gap-2.5">
                      <Label htmlFor="oneClickEmail">{t.email}</Label>
                      <Input
                        id="oneClickEmail"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.emailPlaceholder}
                        required
                      />
                    </div>
                  </>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? t.submitting : t.submit}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
