"use client";

import { useState, useTransition } from "react";
import {
  changeOrderStatusAction,
  createPaymentRequestAction,
  recordPaymentAction,
  createOrderRequestAction,
  unlockOrderAction,
  setReviewedPriceAction,
} from "@/lib/actions/admin-orders";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusOption = { id: string; name: string };

export function StatusChangeForm({
  orderId,
  orderNumber,
  currentStatusId,
  locked,
  statuses,
  dict,
}: {
  orderId: string;
  orderNumber: string;
  currentStatusId: string;
  locked: boolean;
  statuses: StatusOption[];
  dict: Dictionary;
}) {
  const t = dict.admin.workspace;
  const [statusId, setStatusId] = useState(currentStatusId);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{t.statusTitle}</p>
      {locked ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t.locked}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(async () => { await unlockOrderAction(orderId, orderNumber); })}
          >
            {t.unlock}
          </Button>
        </div>
      ) : (
        <>
          <Select
            items={Object.fromEntries(statuses.map((s) => [s.id, s.name]))}
            value={statusId}
            onValueChange={(v) => v && setStatusId(v)}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder={t.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            size="sm"
            disabled={pending || statusId === currentStatusId}
            onClick={() =>
              startTransition(async () => {
                const result = await changeOrderStatusAction(orderId, statusId, note, orderNumber);
                if (!result.ok) setError(result.error ?? "Failed");
                else setNote("");
              })
            }
          >
            {pending ? t.updating : t.updateStatus}
          </Button>
        </>
      )}
    </div>
  );
}

export function ReviewedPriceForm({
  orderId,
  orderNumber,
  currentReviewedPrice,
  dict,
}: {
  orderId: string;
  orderNumber: string;
  currentReviewedPrice: number | null;
  dict: Dictionary;
}) {
  const t = dict.admin.workspace;
  const [amount, setAmount] = useState(currentReviewedPrice != null ? String(currentReviewedPrice) : "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{t.reviewedPriceTitle}</p>
      <p className="text-xs text-muted-foreground">{t.reviewedPriceHint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder={t.amount}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground">{dict.common.currency}</span>
        <Button
          size="sm"
          disabled={pending || !amount || Number(amount) <= 0}
          onClick={() =>
            startTransition(async () => {
              const result = await setReviewedPriceAction(orderId, Number(amount), orderNumber);
              if (!result.ok) setError(result.error ?? "Failed");
              else {
                setSaved(true);
                setError(null);
                setTimeout(() => setSaved(false), 1500);
              }
            })
          }
        >
          {pending ? t.saving : dict.common.save}
        </Button>
        {saved && <span className="text-sm text-success">{dict.common.saved}</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function PaymentRequestForm({ orderId, orderNumber, dict }: { orderId: string; orderNumber: string; dict: Dictionary }) {
  const t = dict.admin.workspace;
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{t.requestPaymentTitle}</p>
      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <Input type="number" min="0" step="0.01" placeholder={t.amount} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder={t.description} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={pending || !amount}
        onClick={() =>
          startTransition(async () => {
            await createPaymentRequestAction(orderId, Number(amount), description, orderNumber);
            setAmount("");
            setDescription("");
          })
        }
      >
        {pending ? t.sending : t.sendRequest}
      </Button>
    </div>
  );
}

export function RecordPaymentForm({ orderId, orderNumber, dict }: { orderId: string; orderNumber: string; dict: Dictionary }) {
  const t = dict.admin.workspace;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{t.recordPaymentTitle}</p>
      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <Input type="number" min="0" step="0.01" placeholder={t.amount} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select
          items={{ bank_transfer: "Bank transfer", cash: "Cash", other: "Other" }}
          value={method}
          onValueChange={(v) => v && setMethod(v)}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bank_transfer">Bank transfer</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        disabled={pending || !amount}
        onClick={() =>
          startTransition(async () => {
            await recordPaymentAction(orderId, Number(amount), method, null, orderNumber);
            setAmount("");
          })
        }
      >
        {pending ? t.saving : t.recordPayment}
      </Button>
    </div>
  );
}

export function OrderRequestForm({ orderId, orderNumber, dict }: { orderId: string; orderNumber: string; dict: Dictionary }) {
  const t = dict.admin.workspace;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{t.requestInfoTitle}</p>
      <div className="grid gap-2">
        <Label htmlFor="reqTitle" className="sr-only">{t.requestInfoTitle}</Label>
        <Input id="reqTitle" placeholder={t.requestTitlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder={t.requestDescPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <Button
        size="sm"
        disabled={pending || !title}
        onClick={() =>
          startTransition(async () => {
            await createOrderRequestAction(orderId, title, description, orderNumber);
            setTitle("");
            setDescription("");
          })
        }
      >
        {pending ? t.sending : t.sendRequest}
      </Button>
    </div>
  );
}
