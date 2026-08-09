import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { FileUpload } from "@/components/orders/file-upload";
import { FileList } from "@/components/orders/file-list";
import { MessageThread } from "@/components/orders/message-thread";
import {
  StatusChangeForm,
  PaymentRequestForm,
  RecordPaymentForm,
  OrderRequestForm,
} from "@/components/admin/order-actions";

export default async function AdminOrderWorkspacePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const supabase = await createServerSupabaseClient();
  const dict = await getDictionary();
  const t = dict.admin.workspace;

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, subject, topic, description, university, college, base_price, discount_source, discount_percentage, discount_amount, final_price, paid_amount, remaining_amount, locked, status_id, guest_name, guest_email, created_at, order_statuses(name, color), services(name), academic_levels(name), deadline_options(label), profiles!orders_user_id_fkey(full_name)"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  const [{ data: statuses }, { data: history }, { data: files }, { data: messages }, { data: paymentRequests }, { data: payments }, { data: discountApps }, { data: referral }] =
    await Promise.all([
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
      supabase.from("referrals").select("id, status, referrer_user_id, referred_user_id").eq("order_id", order.id).maybeSingle(),
    ]);

  const status = Array.isArray(order.order_statuses) ? order.order_statuses[0] : order.order_statuses;
  const service = Array.isArray(order.services) ? order.services[0] : order.services;
  const level = Array.isArray(order.academic_levels) ? order.academic_levels[0] : order.academic_levels;
  const deadline = Array.isArray(order.deadline_options) ? order.deadline_options[0] : order.deadline_options;
  const client = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;

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

      <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl border border-border bg-card p-5 text-sm">
        <div><p className="text-muted-foreground">{t.total}</p><p className="mt-1 font-medium">{Number(order.final_price).toFixed(2)} {dict.common.currency}</p></div>
        <div><p className="text-muted-foreground">{t.paid}</p><p className="mt-1 font-medium">{Number(order.paid_amount).toFixed(2)} {dict.common.currency}</p></div>
        <div><p className="text-muted-foreground">{t.remaining}</p><p className="mt-1 font-medium">{Number(order.remaining_amount).toFixed(2)} {dict.common.currency}</p></div>
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
              <div className="flex gap-6">
                {order.university && <div><p className="text-muted-foreground">{t.university}</p><p>{order.university}</p></div>}
                {order.college && <div><p className="text-muted-foreground">{t.college}</p><p>{order.college}</p></div>}
              </div>
            )}
            {referral && (
              <div>
                <p className="text-muted-foreground">{t.referral}</p>
                <p>{dict.statusLabels[referral.status]}</p>
              </div>
            )}
          </div>
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
                <li key={pr.id} className="flex items-center justify-between px-4 py-3 text-sm">
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
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
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
              <li key={i} className="flex items-center justify-between px-4 py-3">
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
