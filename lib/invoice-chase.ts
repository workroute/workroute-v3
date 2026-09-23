// §Invoice chase — see lib/phone-ai.ts's buildPaymentChaseAssistantConfig
// and app/api/cron/invoice-chase/route.ts. WorkRoute has no payment
// processor, so a bank-transfer/invoice-later job has no signal that it was
// actually paid — invoice_paid_at is a manual toggle (job detail page).
// While it stays null, this drives a week-1 SMS reminder then a week-2
// phone-call escalation; either mechanism setting invoice_paid_at (or the
// tradie doing it themselves) removes the job from both queries below.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PhoneBusinessContext, PaymentChaseClient } from "./phone-ai";
import { buildPaymentChaseAssistantConfig } from "./phone-ai";
import { toE164Au } from "./reactivation";
import { createServiceRoleClient } from "./supabase/service-role";

export type UnpaidInvoiceJob = {
  jobId: string;
  customerName: string;
  customerPhone: string;
  customerAccessToken: string;
  invoiceNumber: number;
  amount: number;
};

// cash/card/payid are settled on the spot at completion time — only these
// two methods mean "the money hasn't actually arrived yet" (see
// PAYMENT_METHODS in app/api/jobs/[id]/send-completion/route.ts).
const CHASEABLE_METHODS = ["bank_transfer", "invoice_later"];

type RawInvoiceJob = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_access_token: string;
  invoice_number: number | null;
  estimated_price: number | null;
  completion_sent_at: string | null;
  invoice_reminder_sent_at: string | null;
  invoice_reminder_call_at: string | null;
};

async function getUnpaidInvoiceJobs(supabase: SupabaseClient, businessId: string): Promise<RawInvoiceJob[]> {
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, customer_name, customer_phone, customer_access_token, invoice_number, estimated_price, completion_sent_at, invoice_reminder_sent_at, invoice_reminder_call_at"
    )
    .eq("business_id", businessId)
    .is("invoice_paid_at", null)
    .not("completion_sent_at", "is", null)
    .not("invoice_number", "is", null)
    .not("customer_phone", "is", null)
    .in("payment_collected_method", CHASEABLE_METHODS);
  return data ?? [];
}

function toUnpaidInvoiceJob(job: RawInvoiceJob): UnpaidInvoiceJob {
  return {
    jobId: job.id,
    customerName: job.customer_name,
    customerPhone: job.customer_phone as string,
    customerAccessToken: job.customer_access_token,
    invoiceNumber: job.invoice_number as number,
    amount: Number(job.estimated_price ?? 0),
  };
}

export async function getInvoicesDueForReminder(
  supabase: SupabaseClient,
  businessId: string,
  daysAfterSent: number
): Promise<UnpaidInvoiceJob[]> {
  const jobs = await getUnpaidInvoiceJobs(supabase, businessId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAfterSent);

  return jobs
    .filter((j) => !j.invoice_reminder_sent_at && new Date(j.completion_sent_at as string) <= cutoff)
    .map(toUnpaidInvoiceJob);
}

export async function getInvoicesDueForCall(
  supabase: SupabaseClient,
  businessId: string,
  daysAfterReminder: number
): Promise<UnpaidInvoiceJob[]> {
  const jobs = await getUnpaidInvoiceJobs(supabase, businessId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAfterReminder);

  return jobs
    .filter((j) => j.invoice_reminder_sent_at && !j.invoice_reminder_call_at && new Date(j.invoice_reminder_sent_at) <= cutoff)
    .map(toUnpaidInvoiceJob);
}

export async function markReminderSent(supabase: SupabaseClient, jobId: string): Promise<void> {
  await supabase.from("jobs").update({ invoice_reminder_sent_at: new Date().toISOString() }).eq("id", jobId);
}

export async function markReminderCallDone(supabase: SupabaseClient, jobId: string): Promise<void> {
  await supabase.from("jobs").update({ invoice_reminder_call_at: new Date().toISOString() }).eq("id", jobId);
}

// Mirrors placeOutboundReactivationCall (lib/reactivation.ts) — job_id is
// known upfront here (unlike a reactivation call, which only creates one
// once a booking actually happens), so it's set on phone_call_captures at
// insert time and handleConfirmInvoicePaid (lib/phone-ai.ts) reads it
// straight back off the call record.
export async function placeOutboundInvoiceChaseCall(
  supabase: SupabaseClient,
  business: PhoneBusinessContext & { vapiPhoneNumberId: string },
  client: PaymentChaseClient & { jobId: string; phone: string }
): Promise<{ ok: true; vapiCallId: string } | { ok: false; error: string }> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "VAPI_API_KEY is not configured." };
  }

  const assistant = buildPaymentChaseAssistantConfig(business, client);

  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistant,
      phoneNumberId: business.vapiPhoneNumberId,
      customer: { number: toE164Au(client.phone) },
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.id) {
    return { ok: false, error: body?.message ?? `Vapi call request failed (${res.status}).` };
  }

  const vapiCallId: string = body.id;

  await createServiceRoleClient().from("phone_call_captures").insert({
    business_id: business.businessId,
    vapi_call_id: vapiCallId,
    caller_number: client.phone,
    job_id: client.jobId,
    call_purpose: "invoice_chase",
  });

  return { ok: true, vapiCallId };
}
