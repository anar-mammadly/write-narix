import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { FileUpload } from "@/components/orders/file-upload";
import { FileList } from "@/components/orders/file-list";
import { MessageThread } from "@/components/orders/message-thread";
import { formatMessage } from "@/lib/i18n/format";
import { ReferralApprovalRow } from "@/components/admin/referral-approval-row";
import { PromoRequestApprovalRow } from "@/components/admin/promo-request-approval-row";
import {
  StatusChangeForm,
  PaymentRequestForm,
  RecordPaymentForm,
  OrderRequestForm,
  ReviewedPriceForm,
} from "@/components/admin/order-actions";

export default async function AdminOrderWorkspacePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const supabase = await createServerSupabaseClient();
  const dict = await getDictionary();
  const t = dict.admin.workspace;

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, subject, topic, description, university, college, base_price, discount_source, discount_percentage, discount_amount, final_price, reviewed_price, paid_amount, remaining_amount, locked, status_id, guest_name, guest_email, created_at, word_count, page_count, order_statuses(name, color), services(name), academic_levels(name), deadline_options(label), languages(name), citation_styles(name), profiles!orders_user_id_fkey(full_name)"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  const [
    { data: statuses },
    { data: history },
    { data: files },
    { data: messages },
    { data: paymentRequests },
    { data: payments },
    { data: discountApps },
    { data: referral },
    { data: promoRequest },
    { data: selectedAddons },
    { data: allAddons },
    { data: contact },
  ] = await Promise.all([
    supabase.from("order_statuses").select("id, name").eq("is_active", true).order("display_order"),
    supabase
      .from("order_status_history")
      .select("note, created_at, order_statuses!order_status_history_to_status_id_fkey(name, color)")
      .eq("order_id", order.id)
      .order("created_at"),
    supabase.from("files").select("id, file_name, category, storage_path, size_bytes, created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("messages").select("id, body, sender_is_admin, created_at").eq("order_id", order.id).order("created_at"),
    supabase.from("payment_requests").select("id, amount, description, status").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("id, amount, method, paid_at").eq("order_id", order.id).order("paid_at", { ascending: false }),
    supabase.from("discount_applications").select("discount_source, percentage_considered, amount_considered, applied, reason").eq("order_id", order.id),
    supabase
      .from("referrals")
      .select(
        "id, status, referral_codes(code), referrer:profiles!referrals_referrer_user_id_fkey(full_name), referred:profiles!referrals_referred_user_id_fkey(full_name)"
      )
      .eq("order_id", order.id)
      .maybeSingle(),
    supabase
      .from("promo_code_requests")
      .select("id, status, promo_codes(code), profiles!promo_code_requests_user_id_fkey(full_name)")
      .eq("order_id", order.id)
      .maybeSingle(),
    supabase.from("order_additional_services").select("additional_service_id").eq("order_id", order.id),
    supabase.from("additional_services").select("id, name, is_plagiarism_addon").eq("is_active", true).order("name"),
    supabase.rpc("get_order_contact", { p_order_id: order.id }),
  ]);

  const status = Array.isArray(order.order_statuses) ? order.order_statuses[0] : order.order_statuses;
  const service = Array.isArray(order.services) ? order.services[0] : order.services;
  const level = Array.isArray(order.academic_levels) ? order.academic_levels[0] : order.academic_levels;
  const deadline = Array.isArray(order.deadline_options) ? order.deadline_options[0] : order.deadline_options;
  const language = Array.isArray(order.languages) ? order.languages[0] : order.languages;
  const citationStyle = Array.isArray(order.citation_styles) ? order.citation_styles[0] : order.citation_styles;
  const client = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;

  const selectedAddonIds = new Set((selectedAddons ?? []).map((a) => a.additional_service_id));

  const referralCode = referral ? (Array.isArray(referral.referral_codes) ? referral.referral_codes[0] : referral.referral_codes) : null;
  const referrer = referral ? (Array.isArray(referral.referrer) ? referral.referrer[0] : referral.referrer) : null;
  const referred = referral ? (Array.isArray(referral.referred) ? referral.referred[0] : referral.referred) : null;

  const promoCode = promoRequest ? (Array.isArray(promoRequest.promo_codes) ? promoRequest.promo_codes[0] : promoRequest.promo_codes) : null;
  const promoProfile = promoRequest ? (Array.isArray(promoRequest.profiles) ? promoRequest.profiles[0] : promoRequest.profiles) : null;

  const contactInfo = contact as { phone: string | null; email: string | null } | null;

  const timeline = (history ?? []).map((h) => {
    const s = Array.isArray(h.order_statuses) ? h.order_statuses[0] : h.order_statuses;
    return { status: s?.name ?? "", color: s?.color ?? "#2A5CAA", note: h.note, created_at: h.created_at };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {client?.full_name ?? order.guest_name ?? order.guest_email ?? dict.admin.orders.guest} · {service?.name} · {level?.name} · {deadline?.label}
          </p>
        </div>
        <Badge style={{ backgroundColor: status?.color, color: "white" }}>{status?.name}</Badge>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-4 text-sm sm:gap-4 sm:p-5">
        <div><p className="text-muted-foreground">{t.total}</p><p className="mt-1 font-medium">{Number(order.final_price).toFixed(2)} {dict.common.currency}</p></div>
        <div><p className="text-muted-foreground">{t.paid}</p><p className="mt-1 font-medium">{Number(order.paid_amount).toFixed(2)} {dict.common.currency}</p></div>
        <div><p className="text-muted-foreground">{t.remaining}</p><p className="mt-1 font-medium">{Number(order.remaining_amount).toFixed(2)} {dict.common.currency}</p></div>
      </div>

      {order.reviewed_price != null && (
        <p className="mt-3 text-sm text-success">
          {t.reviewedPriceLabel} {Number(order.reviewed_price).toFixed(2)} {dict.common.currency}
        </p>
      )}

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">{t.contactTitle}</p>
        <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{dict.admin.orders.client}</p>
            <p>{client?.full_name ?? order.guest_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.email}</p>
            <p>{contactInfo?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.phone}</p>
            <p>{contactInfo?.phone ?? "—"}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">{t.tabs.overview}</TabsTrigger>
          <TabsTrigger value="files">{t.tabs.files}</TabsTrigger>
          <TabsTrigger value="messages">{t.tabs.messages}</TabsTrigger>
          <TabsTrigger value="payments">{t.tabs.payments}</TabsTrigger>
          <TabsTrigger value="discounts">{t.tabs.discounts}</TabsTrigger>
          <TabsTrigger value="timeline">{t.tabs.timeline}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 pt-4">
          <div className="grid gap-3 text-sm">
            <div><p className="text-muted-foreground">{t.subject}</p><p>{order.subject}</p></div>
            <div><p className="text-muted-foreground">{t.topic}</p><p>{order.topic}</p></div>
            <div><p className="text-muted-foreground">{t.instructions}</p><p className="whitespace-pre-wrap">{order.description}</p></div>
            {(order.university || order.college) && (
              <div className="flex flex-wrap gap-4 sm:gap-6">
                {order.university && <div><p className="text-muted-foreground">{t.university}</p><p>{order.university}</p></div>}
                {order.college && <div><p className="text-muted-foreground">{t.college}</p><p>{order.college}</p></div>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">{t.selectionsTitle}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {order.page_count != null && (
                <div><p className="text-muted-foreground">{t.pageCount}</p><p>{order.page_count}</p></div>
              )}
              {order.word_count != null && (
                <div><p className="text-muted-foreground">{t.wordCount}</p><p>{order.word_count}</p></div>
              )}
              <div><p className="text-muted-foreground">{t.language}</p><p>{language?.name ?? "—"}</p></div>
              <div><p className="text-muted-foreground">{t.citationStyle}</p><p>{citationStyle?.name ?? "—"}</p></div>
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">{t.additionalServicesTitle}</p>
            <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
              {(allAddons ?? []).map((addon) => {
                const isSelected = selectedAddonIds.has(addon.id);
                return (
                  <li key={addon.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <span className={isSelected ? "text-foreground" : "text-muted-foreground"}>{addon.name}</span>
                    <Badge variant={isSelected ? "default" : "outline"}>{isSelected ? t.selected : t.notSelected}</Badge>
                  </li>
                );
              })}
            </ul>
          </div>

          {(referral || promoRequest) && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">{t.discountRequestsTitle}</p>
              </div>
              <ul className="divide-y divide-border">
                {referral && referral.status === "pending_approval" && (
                  <ReferralApprovalRow
                    id={referral.id}
                    code={referralCode?.code ?? ""}
                    referrerName={referrer?.full_name ?? "—"}
                    referredName={referred?.full_name ?? "—"}
                    orderNumber={order.order_number}
                    dict={dict}
                  />
                )}
                {referral && referral.status !== "pending_approval" && (
                  <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>{formatMessage(dict.admin.referrals.referredBy, { code: referralCode?.code ?? "", order: order.order_number })}</span>
                    <Badge variant={referral.status === "approved" ? "default" : "outline"}>{dict.statusLabels[referral.status]}</Badge>
                  </li>
                )}
                {promoRequest && promoRequest.status === "pending_approval" && (
                  <PromoRequestApprovalRow
                    id={promoRequest.id}
                    code={promoCode?.code ?? ""}
                    customerName={promoProfile?.full_name ?? order.guest_name ?? order.guest_email ?? dict.admin.referrals.guestCustomer}
                    orderNumber={order.order_number}
                    dict={dict}
                  />
                )}
                {promoRequest && promoRequest.status !== "pending_approval" && (
                  <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>{formatMessage(dict.admin.referrals.promoUsedBy, { code: promoCode?.code ?? "", order: order.order_number })}</span>
                    <Badge variant={promoRequest.status === "approved" ? "default" : "outline"}>{dict.statusLabels[promoRequest.status]}</Badge>
                  </li>
                )}
              </ul>
            </div>
          )}

          <ReviewedPriceForm orderId={order.id} orderNumber={order.order_number} currentReviewedPrice={order.reviewed_price} dict={dict} />
          <StatusChangeForm orderId={order.id} orderNumber={order.order_number} currentStatusId={order.status_id} locked={order.locked} statuses={statuses ?? []} dict={dict} />
          <OrderRequestForm orderId={order.id} orderNumber={order.order_number} dict={dict} />
        </TabsContent>

        <TabsContent value="files" className="pt-4">
          <FileUpload orderId={order.id} category="admin_request" label={dict.dashboard.orderDetail.uploadFile} />
          <FileList files={files ?? []} className="mt-4" />
        </TabsContent>

        <TabsContent value="messages" className="pt-4">
          <MessageThread
            orderId={order.id}
            initialMessages={messages ?? []}
            isAdmin
            emptyLabel={dict.messageThread.empty}
            placeholder={dict.messageThread.placeholder}
            sendErrorLabel={dict.messageThread.sendError}
          />
        </TabsContent>

        <TabsContent value="payments" className="pt-4 grid gap-4">
          <PaymentRequestForm orderId={order.id} orderNumber={order.order_number} dict={dict} />
          <RecordPaymentForm orderId={order.id} orderNumber={order.order_number} dict={dict} />
          <div>
            <p className="text-sm font-medium text-foreground">{t.paymentRequests}</p>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {(paymentRequests ?? []).map((pr) => (
                <li key={pr.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>{pr.description}</span>
                  <span className="flex items-center gap-2"><span>{Number(pr.amount).toFixed(2)} {dict.common.currency}</span><Badge variant={pr.status === "paid" ? "default" : "outline"}>{dict.statusLabels[pr.status]}</Badge></span>
                </li>
              ))}
              {(!paymentRequests || paymentRequests.length === 0) && <li className="px-4 py-3 text-sm text-muted-foreground">{t.none}</li>}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t.paymentHistory}</p>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>{p.method} · {new Date(p.paid_at).toLocaleDateString()}</span>
                  <span className="font-medium">{Number(p.amount).toFixed(2)} {dict.common.currency}</span>
                </li>
              ))}
              {(!payments || payments.length === 0) && <li className="px-4 py-3 text-sm text-muted-foreground">{t.none}</li>}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="discounts" className="pt-4">
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {(discountApps ?? []).map((d, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>{dict.discountSources[d.discount_source]} — {d.percentage_considered}%</span>
                <span className="flex items-center gap-2">
                  <span>{Number(d.amount_considered).toFixed(2)} {dict.common.currency}</span>
                  <Badge variant={d.applied ? "default" : "outline"}>{d.applied ? t.applied : t.notApplied}</Badge>
                </span>
              </li>
            ))}
            {(!discountApps || discountApps.length === 0) && <li className="px-4 py-3 text-muted-foreground">{t.noDiscounts}</li>}
          </ul>
        </TabsContent>

        <TabsContent value="timeline" className="pt-4">
          <OrderTimeline items={timeline} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
