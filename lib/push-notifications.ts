// Parallels lib/notifications.ts's shape for push. §23: every customer-
// facing payload shows only the tradie's business identity — title is
// always businessName, never "WorkRoute".

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPush, type PushSubscriptionRow } from "./push";

async function sendToAll(
  supabase: SupabaseClient,
  table: "owner_push_subscriptions" | "customer_push_subscriptions",
  rows: (PushSubscriptionRow & { id: string })[],
  payload: { title: string; body: string; url: string }
): Promise<void> {
  await Promise.all(
    rows.map((row) =>
      sendPush(row, payload, async () => {
        await supabase.from(table).delete().eq("id", row.id);
      })
    )
  );
}

// §Messenger — fired after a new message lands for the customer, whether
// AI- or tradie-authored. Looks up the messenger link itself so callers
// only need what they already have in scope (jobId, businessName, origin).
export async function notifyCustomerNewMessage(
  supabase: SupabaseClient, // must be service-role — bypasses the (policy-less) customer_push_subscriptions RLS
  jobId: string,
  businessName: string,
  appOrigin: string
): Promise<void> {
  const { data: job } = await supabase
    .from("jobs")
    .select("customer_access_token")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;

  const { data: subs } = await supabase
    .from("customer_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("job_id", jobId);
  if (!subs?.length) return;

  await sendToAll(supabase, "customer_push_subscriptions", subs, {
    title: businessName,
    body: "You have a new message.",
    url: `${appOrigin}/m/${job.customer_access_token}`,
  });
}

// Folds into applyAttentionPriority (lib/messenger-ai.ts) — same "high"-only
// gating as the existing SMS, but doesn't require profile.phone.
export async function notifyOwnerHighPriority(
  supabase: SupabaseClient,
  businessId: string,
  customerName: string,
  jobId: string,
  appOrigin: string
): Promise<void> {
  const { data: subs } = await supabase
    .from("owner_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId);
  if (!subs?.length) return;

  await sendToAll(supabase, "owner_push_subscriptions", subs, {
    title: "Needs your attention",
    body: `${customerName} needs you urgently.`,
    // §32 — lands on the focused Messages thread now, not the general job
    // detail page, since that's the purpose-built place to reply fast.
    url: `${appOrigin}/app/messages/${jobId}`,
  });
}

// §25 revision — the normal completion path for every AI-captured phone
// enquiry now (not just flagged/urgent ones), since the AI hands every new
// call to the tradie to quote by default. Push-only, not SMS — this is a
// routine "here's a new lead" notification, not the urgent escalation
// notifyOwnerHighPriority handles.
export async function notifyOwnerNewPhoneEnquiry(
  supabase: SupabaseClient,
  businessId: string,
  customerName: string,
  jobId: string,
  appOrigin: string
): Promise<void> {
  const { data: subs } = await supabase
    .from("owner_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId);
  if (!subs?.length) return;

  await sendToAll(supabase, "owner_push_subscriptions", subs, {
    title: "New phone enquiry",
    body: `${customerName} called — ready for you to quote.`,
    url: `${appOrigin}/app/jobs/${jobId}`,
  });
}

// §25 — fired when isVoiceFailure (lib/phone-ai.ts) detects the call's own
// voice failed to synthesize. Distinct from notifyOwnerNewPhoneEnquiry — this
// is a "your phone AI is broken" technical alert, not a lead, so it always
// fires regardless of what (if anything) got captured before the caller gave
// up on the silence.
export async function notifyOwnerVoiceFailure(supabase: SupabaseClient, businessId: string, appOrigin: string): Promise<void> {
  const { data: subs } = await supabase
    .from("owner_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId);
  if (!subs?.length) return;

  await sendToAll(supabase, "owner_push_subscriptions", subs, {
    title: "Phone AI voice failed",
    body: "A caller couldn't hear your AI assistant last call — check your voice setup.",
    url: `${appOrigin}/app/settings/phone-ai`,
  });
}

// §trial-limits — the heads-up BEFORE the hard cutoff, sent to the tradie
// themselves (unlike notifyAdminOfTrialLimit below) — they're the one who
// needs to act, and a warning-free "sorry, can't take your call" moment
// would cost them real, live business with zero chance to prevent it.
export async function notifyTradieApproachingTrialLimit(
  supabase: SupabaseClient,
  businessId: string,
  appOrigin: string,
  reason: "days" | "calls"
): Promise<void> {
  const { data: subs } = await supabase
    .from("owner_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId);
  if (!subs?.length) return;

  // §payment-link — PAYMENT_LINK_URL is a plain env var, not hardcoded,
  // specifically so it can be swapped without a code change if the payment
  // provider ever changes (currently GoCardless). Falls back to Settings
  // if it's not set yet, rather than sending a broken/undefined link.
  const paymentLink = process.env.PAYMENT_LINK_URL;
  const callToAction = paymentLink ? " Click here to continue." : " Get in touch to keep going.";
  const body =
    (reason === "days"
      ? "Your free trial ends in a few days — Sarah will pause until you upgrade."
      : "You're approaching your free trial's call limit — Sarah will pause until you upgrade.") + callToAction;

  await sendToAll(supabase, "owner_push_subscriptions", subs, {
    title: "Your free trial is almost up",
    body,
    url: paymentLink || `${appOrigin}/app/settings`,
  });
}

// §trial-limits — deliberately notifies the WorkRoute owner (ADMIN_USER_ID),
// not the tradie whose trial just ran out. Same shape as
// notifyOwnerVoiceFailure above, just pointed at a different business_id —
// the owner's own push subscriptions, so he can personally follow up about
// converting them, rather than the tradie finding out via a push of their
// own.
export async function notifyAdminOfTrialLimit(
  supabase: SupabaseClient,
  tradieBusinessName: string,
  appOrigin: string
): Promise<void> {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return;

  const { data: subs } = await supabase
    .from("owner_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", adminId);
  if (!subs?.length) return;

  await sendToAll(supabase, "owner_push_subscriptions", subs, {
    title: "Trial limit reached",
    body: `${tradieBusinessName} has hit their free trial limit — Sarah's paused for them until they convert.`,
    url: `${appOrigin}/app/admin/overview`,
  });
}

// §25 — fired instead of notifyOwnerNewPhoneEnquiry when book_appointment
// actually locked in a time during the call, so the tradie knows there's
// already something on the calendar rather than just a lead to call back.
export async function notifyOwnerPhoneBooking(
  supabase: SupabaseClient,
  businessId: string,
  customerName: string,
  jobId: string,
  appOrigin: string,
  quoteRequired: boolean
): Promise<void> {
  const { data: subs } = await supabase
    .from("owner_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId);
  if (!subs?.length) return;

  await sendToAll(supabase, "owner_push_subscriptions", subs, {
    title: quoteRequired ? "Quote visit booked from a call" : "Job booked from a call",
    body: `${customerName} is on the calendar — give them a call beforehand to confirm details.`,
    url: `${appOrigin}/app/jobs/${jobId}`,
  });
}

// Called from the weather cron route.
// §44 — the daily 3pm "tomorrow's jobs & weather" briefing, sent every day
// regardless of forecast, so the tradie has what they need to decide
// whether tomorrow's jobs can actually go ahead — not just an alarm on bad
// days like notifyOwnerWeatherWarning below.
export async function notifyOwnerDailyBriefing(
  supabase: SupabaseClient,
  businessId: string,
  jobCount: number,
  jobSummary: string,
  weatherSummary: string | null,
  appOrigin: string
): Promise<void> {
  const { data: subs } = await supabase
    .from("owner_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId);
  if (!subs?.length) return;

  const body = jobCount
    ? `Tomorrow: ${jobSummary}.${weatherSummary ? ` Weather: ${weatherSummary}.` : ""}`
    : `Nothing on the run sheet for tomorrow yet.${weatherSummary ? ` Weather: ${weatherSummary}.` : ""}`;

  await sendToAll(supabase, "owner_push_subscriptions", subs, {
    title: "Tomorrow's jobs & weather",
    body,
    url: `${appOrigin}/app/calendar`,
  });
}

export async function notifyOwnerWeatherWarning(
  supabase: SupabaseClient,
  businessId: string,
  jobCount: number,
  appOrigin: string
): Promise<void> {
  const { data: subs } = await supabase
    .from("owner_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("business_id", businessId);
  if (!subs?.length) return;

  await sendToAll(supabase, "owner_push_subscriptions", subs, {
    title: "Bad weather forecast",
    body: `Rain or storms forecast for ${jobCount} scheduled job${jobCount === 1 ? "" : "s"} today or tomorrow.`,
    url: `${appOrigin}/app/run-sheet`,
  });
}
