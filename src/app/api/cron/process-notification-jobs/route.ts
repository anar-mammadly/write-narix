import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { renderTemplate } from "@/lib/email/render-template";

// Background outbox worker. Invoked on a schedule (e.g. a Cloudflare Cron
// Trigger, or any external scheduler) hitting this route every 1-2 minutes
// with `Authorization: Bearer ${CRON_SECRET}`. It claims a batch of pending
// notification_jobs atomically (status flip pending -> processing, guarded
// by the WHERE clause, so two overlapping worker runs can't double-send the
// same job), renders the matching email_templates row, sends via Resend,
// and records success/failure with exponential backoff — a send failure
// here never touches the order/status/payment/referral row that queued it.
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data: jobs, error } = await supabase
    .from("notification_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at")
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: "could not load jobs" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    // Claim it — if another worker run already claimed this job, this
    // update affects 0 rows and we skip it.
    const { data: claimed } = await supabase
      .from("notification_jobs")
      .update({ status: "processing", attempts: job.attempts + 1 })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .single();

    if (!claimed) continue;

    try {
      const to = job.recipient_email;
      if (!to) throw new Error("no recipient email");

      let subject = job.event_type;
      let bodyHtml = `<p>${job.event_type}</p>`;

      if (job.template_key) {
        const { data: template } = await supabase
          .from("email_templates")
          .select("subject, body_html")
          .eq("key", job.template_key)
          .single();
        if (template) {
          const payload = (job.payload ?? {}) as Record<string, unknown>;
          subject = renderTemplate(template.subject, payload);
          bodyHtml = renderTemplate(template.body_html, payload);
        }
      }

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "Narix Academy <orders@writing.narix.az>",
        to,
        subject,
        html: bodyHtml,
      });

      await supabase
        .from("notification_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", job.id);
      sent += 1;
    } catch (err) {
      const attempts = job.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      const backoffMinutes = Math.min(60, 2 ** attempts);

      await supabase
        .from("notification_jobs")
        .update({
          status: exhausted ? "failed" : "pending",
          last_error: err instanceof Error ? err.message : "unknown error",
          next_attempt_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
        })
        .eq("id", job.id);
      failed += 1;
    }
  }

  return NextResponse.json({ processed: (jobs ?? []).length, sent, failed });
}
