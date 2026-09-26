// §quote-followup — Sarah calling back after an on-site quote to ask if the
// customer wants to go ahead. Timed the way people actually decide (the
// owner's own words: "people act fast, 3 days the job is already done by
// someone else") rather than the week-plus cadence invoice-chase uses for a
// payment reminder: a quote given in the morning gets called back that same
// afternoon, one given in the afternoon/evening gets called the next
// morning. See app/api/cron/quote-followup/route.ts (runs twice a day) and
// lib/phone-ai.ts's buildQuoteFollowupAssistantConfig for the call itself,
// and app/api/vapi/webhook/route.ts's handleEndOfCallReport for how the
// outcome gets read back once the call ends.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PhoneBusinessContext, QuoteFollowupClient } from "./phone-ai";
import { buildQuoteFollowupAssistantConfig } from "./phone-ai";
import { toE164Au } from "./reactivation";
import { createServiceRoleClient } from "./supabase/service-role";

// Two attempts, not more — the owner's own call: enough to actually reach
// someone without turning into pestering.
const MAX_ATTEMPTS = 2;

export type QuoteFollowupJob = {
  jobId: string;
  customerName: string;
  customerPhone: string;
  jobLabel: string | null;
  quotedPrice: number;
  attempts: number;
};

type RawQuoteJob = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  job_label: string | null;
  quoted_price: number | null;
  quote_given_at: string | null;
  quote_followup_attempts: number;
};

function brisbaneParts(date: Date): { dateKey: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

// A quote given before midday is due once the same Brisbane day reaches the
// afternoon; one given at midday or later isn't due until the next Brisbane
// day at all. Only gates the *first* call — once one attempt has been made
// and didn't connect, the job is eligible again on the very next cron run
// (see getQuoteJobsDueForCall), which is itself already a few hours later —
// that's the whole "don't pester" pacing, no separate cooldown needed.
function isDueForFirstCall(quoteGivenAt: string): boolean {
  const given = brisbaneParts(new Date(quoteGivenAt));
  const now = brisbaneParts(new Date());
  if (given.dateKey !== now.dateKey) return true;
  return given.hour < 12 && now.hour >= 12;
}

function toQuoteFollowupJob(job: RawQuoteJob): QuoteFollowupJob {
  return {
    jobId: job.id,
    customerName: job.customer_name,
    customerPhone: job.customer_phone as string,
    jobLabel: job.job_label,
    quotedPrice: Number(job.quoted_price ?? 0),
    attempts: job.quote_followup_attempts,
  };
}

export async function getQuoteJobsDueForCall(supabase: SupabaseClient, businessId: string): Promise<QuoteFollowupJob[]> {
  const { data } = await supabase
    .from("jobs")
    .select("id, customer_name, customer_phone, job_label, quoted_price, quote_given_at, quote_followup_attempts")
    .eq("business_id", businessId)
    .eq("quote_followup_done", false)
    .lt("quote_followup_attempts", MAX_ATTEMPTS)
    .not("quote_given_at", "is", null)
    .not("quoted_price", "is", null)
    .not("customer_phone", "is", null);

  return (data ?? [])
    .filter((j) => j.quote_followup_attempts > 0 || isDueForFirstCall(j.quote_given_at as string))
    .map(toQuoteFollowupJob);
}

// Mirrors placeOutboundInvoiceChaseCall (lib/invoice-chase.ts) — job_id is
// known upfront (it's the same quote-visit job being followed up on), so
// it's set on phone_call_captures at insert time and book_appointment
// (lib/phone-ai.ts) reads it straight back off the call record if the
// customer wants to go ahead, re-opening this same job as a real booking.
export async function placeOutboundQuoteFollowupCall(
  supabase: SupabaseClient,
  business: PhoneBusinessContext & { vapiPhoneNumberId: string },
  client: QuoteFollowupJob
): Promise<{ ok: true; vapiCallId: string } | { ok: false; error: string }> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "VAPI_API_KEY is not configured." };
  }

  const followupClient: QuoteFollowupClient = {
    name: client.customerName,
    jobLabel: client.jobLabel,
    quotedPrice: client.quotedPrice,
  };
  const assistant = buildQuoteFollowupAssistantConfig(business, followupClient);

  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistant,
      phoneNumberId: business.vapiPhoneNumberId,
      customer: { number: toE164Au(client.customerPhone) },
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
    caller_number: client.customerPhone,
    job_id: client.jobId,
    call_purpose: "quote_followup",
  });

  // Incremented at placement time, not once the outcome is known — a safety
  // net against a second attempt firing before the end-of-call-report for
  // this one has even landed, on top of the "attempts > 0 → eligible again
  // next run" pacing this file's read side already relies on.
  await supabase.from("jobs").update({ quote_followup_attempts: client.attempts + 1 }).eq("id", client.jobId);

  return { ok: true, vapiCallId };
}

// Vapi's endedReason for a call that never actually reached anyone —
// anything else (a real conversation, however short) counts as "reached
// them" for this feature's purposes, even if the outcome was a firm no,
// since the point of the two-attempt cap is specifically "we couldn't get
// hold of them," not repeating after an actual conversation. Called from
// app/api/vapi/webhook/route.ts's handleEndOfCallReport once a
// call_purpose "quote_followup" call ends.
const NOT_CONNECTED_ENDED_REASONS = ["customer-did-not-answer", "customer-busy", "voicemail"];

function quoteFollowupConnected(endedReason: string | null | undefined): boolean {
  if (!endedReason) return true; // unknown reason — assume it connected rather than silently over-retrying
  return !NOT_CONNECTED_ENDED_REASONS.includes(endedReason);
}

// Both attempts came back unable to reach the customer at all — this stops
// future attempts and lets the tradie know it needs a personal follow-up,
// same "Needs Attention" inbox flag_for_attention itself writes to, since
// the AI never got a chance to call that tool (the call never connected).
async function flagQuoteFollowupUnreachable(supabase: SupabaseClient, jobId: string, businessId: string): Promise<void> {
  await supabase.from("jobs").update({ quote_followup_done: true, attention_priority: "medium" }).eq("id", jobId);
  await supabase.from("messages").insert({
    job_id: jobId,
    business_id: businessId,
    sender: "ai",
    body: "Tried following up on this quote twice by phone but couldn't reach the customer — worth a personal follow-up.",
    visible_to_customer: false,
  });
}

// Called from app/api/vapi/webhook/route.ts's handleEndOfCallReport once a
// call_purpose "quote_followup" call ends, in place of the generic
// recalculateEstimate/notifyNewPhoneJob path every other call type gets —
// this job's price/status were already settled by the quote-visit
// completion (or by book_appointment, if the customer said yes on this
// call), so none of that generic post-call work applies here.
export async function resolveQuoteFollowupCallOutcome(
  supabase: SupabaseClient,
  jobId: string,
  businessId: string,
  endedReason: string | null | undefined
): Promise<void> {
  if (quoteFollowupConnected(endedReason)) {
    // Whatever happened on the call — booked, flagged as undecided/declined
    // by the AI itself — a real conversation happened, so no further
    // attempts are wanted regardless of attempt count.
    await supabase.from("jobs").update({ quote_followup_done: true }).eq("id", jobId);
    return;
  }

  const { data: job } = await supabase.from("jobs").select("quote_followup_attempts").eq("id", jobId).maybeSingle();
  if (job && job.quote_followup_attempts >= MAX_ATTEMPTS) {
    await flagQuoteFollowupUnreachable(supabase, jobId, businessId);
  }
  // Otherwise: didn't connect, attempts remain below the cap — leave it
  // open, getQuoteJobsDueForCall will pick it up again on the next cron run.
}
