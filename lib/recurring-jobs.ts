import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAvailability } from "./messenger-scheduling";

export type RecurringFrequency = "Weekly" | "Fortnightly" | "Monthly";

// Monthly is deliberately 4 weeks (28 days), not a calendar month — that
// keeps the same weekday every time, which is what a customer actually means
// by "mow it once a month," not "the 14th of every month" drifting across
// weekdays.
const FREQUENCY_DAYS: Record<RecurringFrequency, number> = {
  Weekly: 7,
  Fortnightly: 14,
  Monthly: 28,
};

// How many future visits to create up front, beyond the first (already
// booked) one. Deliberately a bounded batch, not open-ended automation —
// there's no cron/scheduled job in this app that's confirmed reliably
// running in production (see project notes on the pre-existing
// weather-check cron), so "keep generating forever in the background" isn't
// a safe thing to build on yet. A tradie can always book further visits once
// a series runs low; raising this constant is a trivial follow-up if 5 turns
// out to be too short in practice.
const OCCURRENCES_TO_CREATE = 5;

export type RecurringSeriesResult = {
  seriesId: string;
  createdDates: string[];
  skippedDates: string[]; // already taken on that business's calendar — left as a gap for the tradie to sort out manually, not auto-shifted to a different day
};

// Called right after the very first visit of a "Regular" job has already
// been booked via handleBookAppointment — this only adds the *additional*
// occurrences on top, cloning that first job's customer/address/trade
// details onto each new row (a customer's job details don't change between
// their own recurring visits), all tagged with the same recurring_series_id
// so they're visibly linked (job detail page, run sheet, jobs list).
export async function createRecurringSeries(
  supabase: SupabaseClient,
  businessId: string,
  firstJobId: string,
  startDate: string,
  time: string | null,
  block: "Morning" | "Afternoon" | "Evening" | null,
  frequency: RecurringFrequency
): Promise<RecurringSeriesResult | null> {
  const { data: firstJob } = await supabase
    .from("jobs")
    .select(
      "business_id, source, customer_name, customer_phone, address_street, address_suburb, address_postcode, trade_answers, estimated_duration_minutes, estimated_price, quote_required, confidence, job_label, client_id"
    )
    .eq("id", firstJobId)
    .maybeSingle();
  if (!firstJob) return null;

  const seriesId = crypto.randomUUID();
  await supabase
    .from("jobs")
    .update({ recurring_series_id: seriesId, recurring_frequency: frequency })
    .eq("id", firstJobId);

  const stepDays = FREQUENCY_DAYS[frequency];
  const createdDates: string[] = [];
  const skippedDates: string[] = [];

  let cursor = new Date(`${startDate}T00:00:00`);
  for (let i = 0; i < OCCURRENCES_TO_CREATE; i++) {
    cursor = new Date(cursor.getTime() + stepDays * 24 * 60 * 60 * 1000);
    const dateStr = cursor.toISOString().slice(0, 10);

    // excludeJobId is firstJobId for every iteration on purpose — none of
    // the not-yet-created future occurrences exist yet to conflict with
    // each other, only against the business's already-scheduled jobs.
    const availability = await checkAvailability(supabase, businessId, firstJobId, { date: dateStr, time, block });
    if (!availability.available) {
      skippedDates.push(dateStr);
      continue;
    }

    const { data: sameDayJobs } = await supabase
      .from("jobs")
      .select("run_order")
      .eq("business_id", businessId)
      .eq("scheduled_date", dateStr);
    const maxOrder = (sameDayJobs ?? []).reduce((max, j) => Math.max(max, j.run_order ?? 0), 0);

    const { error } = await supabase.from("jobs").insert({
      business_id: businessId,
      source: firstJob.source,
      customer_name: firstJob.customer_name,
      customer_phone: firstJob.customer_phone,
      address_street: firstJob.address_street,
      address_suburb: firstJob.address_suburb,
      address_postcode: firstJob.address_postcode,
      trade_answers: firstJob.trade_answers,
      estimated_duration_minutes: firstJob.estimated_duration_minutes,
      estimated_price: firstJob.estimated_price,
      quote_required: firstJob.quote_required,
      confidence: firstJob.confidence,
      job_label: firstJob.job_label,
      client_id: firstJob.client_id,
      status: "Scheduled",
      scheduled_date: dateStr,
      scheduled_time: time,
      scheduled_block: block,
      run_order: maxOrder + 10,
      recurring_series_id: seriesId,
      recurring_frequency: frequency,
    });

    if (!error) createdDates.push(dateStr);
  }

  return { seriesId, createdDates, skippedDates };
}

export type SeriesRenewalCandidate = {
  jobId: string;
  customerName: string;
  customerPhone: string;
  customerAccessToken: string;
  scheduledDate: string;
};

// §Recurring renewal — finds the LAST visit of each still-open recurring
// series that falls within `daysAhead` days, and hasn't been prompted (or
// already declined) yet. "Last" means no other job shares its
// recurring_series_id with a later scheduled_date — which is also true again
// for a freshly-renewed series's own new last visit, so a renewed series
// naturally reappears here once it's due again, with no extra bookkeeping.
export async function getSeriesDueForRenewalPrompt(
  supabase: SupabaseClient,
  businessId: string,
  daysAhead: number
): Promise<SeriesRenewalCandidate[]> {
  const { data: seriesJobs } = await supabase
    .from("jobs")
    .select(
      "id, recurring_series_id, scheduled_date, customer_name, customer_phone, customer_access_token, recurring_renewal_prompted_at, recurring_renewal_declined_at"
    )
    .eq("business_id", businessId)
    .eq("status", "Scheduled")
    .not("recurring_series_id", "is", null)
    .not("customer_phone", "is", null);

  if (!seriesJobs || seriesJobs.length === 0) return [];

  const lastBySeries = new Map<string, (typeof seriesJobs)[number]>();
  for (const job of seriesJobs) {
    const seriesId = job.recurring_series_id as string;
    const current = lastBySeries.get(seriesId);
    if (!current || job.scheduled_date > current.scheduled_date) {
      lastBySeries.set(seriesId, job);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return [...lastBySeries.values()]
    .filter(
      (job) =>
        job.scheduled_date >= today &&
        job.scheduled_date <= cutoffDate &&
        !job.recurring_renewal_prompted_at &&
        !job.recurring_renewal_declined_at
    )
    .map((job) => ({
      jobId: job.id,
      customerName: job.customer_name,
      customerPhone: job.customer_phone as string,
      customerAccessToken: job.customer_access_token,
      scheduledDate: job.scheduled_date,
    }));
}

export async function markRenewalPrompted(supabase: SupabaseClient, jobId: string): Promise<void> {
  await supabase.from("jobs").update({ recurring_renewal_prompted_at: new Date().toISOString() }).eq("id", jobId);
}

export async function markRenewalDeclined(supabase: SupabaseClient, jobId: string): Promise<void> {
  await supabase.from("jobs").update({ recurring_renewal_declined_at: new Date().toISOString() }).eq("id", jobId);
}

// Called when the customer says yes to the renewal reminder (see
// lib/messenger-ai.ts's confirm_recurring_renewal tool). Re-anchors off the
// same last job's own date/time/frequency — createRecurringSeries stamps it
// with a fresh recurring_series_id and adds the next batch after it, so this
// job naturally stops matching getSeriesDueForRenewalPrompt above (it's no
// longer the last one in its series).
export async function renewSeriesFromLastJob(
  supabase: SupabaseClient,
  businessId: string,
  jobId: string
): Promise<RecurringSeriesResult | null> {
  const { data: job } = await supabase
    .from("jobs")
    .select("scheduled_date, scheduled_time, scheduled_block, recurring_frequency")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || !job.recurring_frequency) return null;

  return createRecurringSeries(
    supabase,
    businessId,
    jobId,
    job.scheduled_date,
    job.scheduled_time,
    job.scheduled_block as "Morning" | "Afternoon" | "Evening" | null,
    job.recurring_frequency as RecurringFrequency
  );
}
