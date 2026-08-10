import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MessageCircle, Info } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteSettings, buildWhatsAppUrl } from "@/lib/data/site-settings";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string; referral?: string; promo?: string }>;
}) {
  const { orderNumber } = await params;
  const { token, referral, promo } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [settings, dict] = await Promise.all([getSiteSettings(), getDictionary()]);

  const discountCodeStatus = dict.calculator.discountCodeStatus as Record<string, string>;
  const referralNote = referral ? discountCodeStatus[referral] : null;
  const promoNote = promo ? discountCodeStatus[promo] : null;

  let order: {
    order_number: string;
    final_price: number;
    paid_amount: number;
    remaining_amount: number;
    status: { name: string } | null;
  } | null = null;

  if (token) {
    const { data } = await supabase.rpc("get_order_by_token", { p_token: token });
    if (data) {
      const parsed = data as unknown as {
        order_number: string;
        final_price: number;
        paid_amount: number;
        remaining_amount: number;
        status: { name: string };
      };
      order = parsed;
    }
  } else {
    const { data } = await supabase
      .from("orders")
      .select("order_number, final_price, paid_amount, remaining_amount, order_statuses(name)")
      .eq("order_number", orderNumber)
      .single();
    if (data) {
      order = {
        order_number: data.order_number,
        final_price: data.final_price,
        paid_amount: data.paid_amount,
        remaining_amount: data.remaining_amount,
        status: Array.isArray(data.order_statuses) ? data.order_statuses[0] : data.order_statuses,
      };
    }
  }

  if (!order) notFound();

  const trackUrl = token ? `/track/${token}` : "/dashboard/orders";

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <CheckCircle2 className="mx-auto size-12 text-success" />
      <h1 className="mt-4 font-heading text-2xl font-semibold text-foreground">{dict.orderConfirmation.title}</h1>
      <p className="mt-2 text-muted-foreground">{dict.orderConfirmation.orderNumber}</p>
      <p className="font-heading text-xl font-semibold text-foreground">{order.order_number}</p>

      <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-4 text-sm sm:gap-4 sm:p-5">
        <div>
          <p className="text-muted-foreground">{dict.orderConfirmation.status}</p>
          <p className="mt-1 font-medium text-foreground">{order.status?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{dict.orderConfirmation.total}</p>
          <p className="mt-1 font-medium text-foreground">{Number(order.final_price).toFixed(2)} {dict.common.currency}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{dict.orderConfirmation.remaining}</p>
          <p className="mt-1 font-medium text-foreground">{Number(order.remaining_amount).toFixed(2)} {dict.common.currency}</p>
        </div>
      </div>

      {token && (
        <p className="mt-4 text-xs text-muted-foreground">
          {dict.orderConfirmation.saveLinkPrefix}{" "}
          <Link href={trackUrl} className="text-primary underline">{trackUrl}</Link>
        </p>
      )}

      {(referralNote || promoNote) && (
        <div className="mt-4 grid gap-2 text-left">
          {referralNote && (
            <p className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${referral === "pending_approval" ? "border-success/30 bg-success-soft text-foreground" : "border-warning/30 bg-warning-soft text-foreground"}`}>
              <Info className="mt-0.5 size-4 shrink-0" />
              {referralNote}
            </p>
          )}
          {promoNote && (
            <p className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${promo === "pending_approval" ? "border-success/30 bg-success-soft text-foreground" : "border-warning/30 bg-warning-soft text-foreground"}`}>
              <Info className="mt-0.5 size-4 shrink-0" />
              {promoNote}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button variant="outline" render={<Link href={trackUrl} />}>
          {dict.orderConfirmation.viewOrder}
        </Button>
        <Button render={<a href={buildWhatsAppUrl(settings.whatsappNumber, `${dict.whatsapp.confirmMessage} ${order.order_number}.`)} target="_blank" rel="noopener noreferrer" />}>
          <MessageCircle className="size-4" /> {dict.orderConfirmation.whatsappCta}
        </Button>
      </div>

      {!token && (
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/signup" className="text-primary hover:underline">{dict.orderConfirmation.createAccount}</Link> {dict.orderConfirmation.createAccountPrompt}
        </p>
      )}
    </div>
  );
}
