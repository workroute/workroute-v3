import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendCompletionEmail } from "@/lib/resend";
import { sendSms as sendTextMessage } from "@/lib/mobile-message";
import { messageFor } from "@/lib/notifications";

const PAYMENT_METHODS = ["cash", "card", "payid", "bank_transfer", "invoice_later"];

// §55 — fire-and-forget: a slow or dead Zapier webhook must never delay or
// fail the actual customer send, so this is deliberately never awaited by
// the caller. Logs failures server-side only.
function fireZapierWebhook(url: string, payload: Record<string, unknown>): void {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error("[send-completion] Zapier webhook failed —", error);
  });
}

// §39 — step 2 of the voice completion recap: the tradie has reviewed
// (and possibly edited) the AI's draft summary/total, and is now actually
// sending it. Saves the recap on the job either way (audit trail, same
// principle as phone_call_captures), then sends via whichever channel(s)
// were picked.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const summary = body?.summary;
  const total = body?.total;
  const transcript = body?.transcript;
  const sendSms = Boolean(body?.sendSms);
  const sendEmail = Boolean(body?.sendEmail);
  const email = typeof body?.email === "string" ? body.email.trim() : null;
  const paymentMethod = body?.paymentMethod;

  if (typeof summary !== "string" || summary.length < 1 || summary.length > 1800 || typeof total !== "number") {
    return NextResponse.json({ ok: false, error: "Missing or invalid summary/total." }, { status: 400 });
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ ok: false, error: "Select how you were paid." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, client_id, customer_name, customer_email, customer_phone, customer_access_token, job_label, address_street, address_suburb, scheduled_date"
    )
    .eq("id", params.id)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }

  if (sendEmail && !email && !job.customer_email) {
    return NextResponse.json({ ok: false, error: "No email address to send to." }, { status: 400 });
  }

  const resolvedEmail = email || job.customer_email;

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("business_name, first_name, google_review_link, bank_details, zapier_webhook_url, next_invoice_number")
    .eq("user_id", user.id)
    .maybeSingle();

  // §55 — a real sequential invoice number, assigned only now (at send
  // time), not when the job was first captured — a job that never gets
  // completed/invoiced should never burn a number, so gaps in the sequence
  // stay meaningful (matches how paper invoice books work).
  const invoiceNumber = profile?.next_invoice_number ?? 1;
  await supabase
    .from("business_profiles")
    .update({ next_invoice_number: invoiceNumber + 1 })
    .eq("user_id", user.id);

  const jobUpdate: Record<string, unknown> = {
    completion_summary: summary,
    completion_transcript: typeof transcript === "string" ? transcript : null,
    completion_sent_at: new Date().toISOString(),
    estimated_price: total,
    payment_collected_method: paymentMethod,
    invoice_number: invoiceNumber,
  };
  if (email && email !== job.customer_email) {
    jobUpdate.customer_email = email;
  }

  await supabase.from("jobs").update(jobUpdate).eq("id", job.id);

  if (email && job.client_id) {
    await supabase.from("clients").update({ email }).eq("id", job.client_id);
  }

  const results: { sms?: { ok: boolean; error?: string }; email?: { ok: boolean; error?: string } } = {};

  // §40 — piggybacks the Google review ask onto the same completion send,
  // rather than a separate message — only added when the tradie has set a
  // link (Profile > Google review link), never a bare invented request.
  const reviewLine = profile?.google_review_link
    ? `\n\nIf you were happy with the job, a quick Google review helps us out: ${profile.google_review_link}`
    : "";

  // §55 — bank details are plain text the tradie typed in themselves
  // (Profile > Bank details) — shown exactly as given, never parsed or
  // validated, since WorkRoute never touches the actual payment.
  const bankLine = profile?.bank_details ? `\n\nPayment details:\n${profile.bank_details}` : "";
  const invoiceLine = `Invoice #${invoiceNumber}`;

  if (sendSms) {
    const { error } = await supabase.from("messages").insert({
      job_id: job.id,
      business_id: user.id,
      sender: "tradie",
      body: `${invoiceLine}\n\n${summary}\n\nTotal: $${total.toFixed(2)}${bankLine}${reviewLine}`,
    });

    // §next-visit-on-completion (fix, found while testing that feature) —
    // the message above only ever landed in the customer's private
    // Messenger thread; nothing told them it was there unless they already
    // had that page open. SMS is meant to be a one-way invitation only (see
    // lib/notifications.ts's header comment) — the actual detail lives
    // behind the link, this just lets them know to go look.
    let inviteResult: { ok: boolean; error?: string } = { ok: true };
    if (!error && job.customer_phone) {
      const messengerLink = `${new URL(request.url).origin}/m/${job.customer_access_token}`;
      const inviteText = messageFor(
        "completed",
        job.customer_name,
        profile?.first_name ?? null,
        profile?.business_name || "Your tradie",
        messengerLink
      );
      inviteResult = await sendTextMessage(job.customer_phone, inviteText);
    }

    results.sms = error
      ? { ok: false, error: error.message }
      : inviteResult.ok
        ? { ok: true }
        : { ok: false, error: inviteResult.error };
  }

  if (sendEmail && resolvedEmail) {
    results.email = await sendCompletionEmail(
      resolvedEmail,
      job.customer_name,
      profile?.business_name || "Your tradie",
      summary,
      total,
      profile?.google_review_link || null,
      invoiceNumber,
      profile?.bank_details || null
    );
  }

  // §55 — fired regardless of which customer channels were picked; this is
  // for the tradie's own accounting sync, not customer-facing.
  if (profile?.zapier_webhook_url) {
    fireZapierWebhook(profile.zapier_webhook_url, {
      event: "job_completed",
      invoiceNumber,
      jobId: job.id,
      customerName: job.customer_name,
      customerEmail: resolvedEmail,
      jobLabel: job.job_label,
      addressStreet: job.address_street,
      addressSuburb: job.address_suburb,
      scheduledDate: job.scheduled_date,
      summary,
      total,
      paymentMethod,
      sentAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, results, invoiceNumber });
}
