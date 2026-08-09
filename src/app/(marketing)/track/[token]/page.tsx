import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { ClaimOrderBanner } from "@/components/orders/claim-order-banner";

type TrackedOrder = {
  order_number: string;
  status: { name: string; color: string } | null;
  final_price: number;
  paid_amount: number;
  remaining_amount: number;
  is_fully_paid: boolean;
  created_at: string;
  claimed: boolean;
  timeline: { status: string; color: string; note: string | null; created_at: string }[];
};

export default async function TrackOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data }, dict] = await Promise.all([
    supabase.rpc("get_order_by_token", { p_token: token }),
    getDictionary(),
  ]);

  if (!data) notFound();
  const order = data as unknown as TrackedOrder;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted-foreground">{dict.track.order}</p>
      <h1 className="font-heading text-2xl font-semibold text-foreground">{order.order_number}</h1>

      <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-4 text-sm sm:gap-4 sm:p-5">
        <div>
          <p className="text-muted-foreground">{dict.track.status}</p>
          <p className="mt-1 font-medium text-foreground">{order.status?.name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{dict.track.total}</p>
          <p className="mt-1 font-medium text-foreground">{Number(order.final_price).toFixed(2)} {dict.common.currency}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{dict.track.remaining}</p>
          <p className="mt-1 font-medium text-foreground">{Number(order.remaining_amount).toFixed(2)} {dict.common.currency}</p>
        </div>
      </div>

      {!order.claimed && <ClaimOrderBanner orderNumber={order.order_number} token={token} dict={dict} />}

      <div className="mt-8">
        <h2 className="text-sm font-medium text-foreground">{dict.track.timeline}</h2>
        <OrderTimeline items={order.timeline} className="mt-4" emptyLabel={dict.track.noHistory} />
      </div>
    </div>
  );
}
