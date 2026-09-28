import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { geocodeAddress } from "@/lib/google-maps";
import { checkAvailability, suggestAvailableTimes, rescheduleJob } from "@/lib/messenger-scheduling";
import { messageFor, formatAppointmentLabel } from "@/lib/notifications";
import { sendSms } from "@/lib/mobile-message";
import { notifyOwnerPublicBooking } from "@/lib/push-notifications";

// §public-booking-page — the public endpoint behind app/book/[widgetKey],
// a shareable link (Calendly-style) so a customer can pick a real free slot
// and book themselves in, no call or chat needed. Reuses widget_key (already
// public by design — see app/api/widget/[widgetKey]/route.ts's own header
// comment) rather than adding a second public identifier, and reuses the
// exact same scheduling logic (lib/messenger-scheduling.ts) the phone AI and
// Messenger already rely on, so there's one scheduling algorithm, not three.
// Same DB-backed rate limiting as the widget route, for the same reason:
// this is a fully public, unauthenticated surface.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

const PER_SESSION_WINDOW_MS = 30 * 60 * 1000;
const PER_SESSION_MAX = 30;
const PER_BUSINESS_WINDOW_MS = 60 * 60 * 1000;
const PER_BUSINESS_MAX = 100;

async function isRateLimited(
  supabase: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  sessionId: string
): Promise<boolean> {
  const now = Date.now();

  const { count: sessionCount } = await supabase
    .from("widget_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .gte("created_at", new Date(now - PER_SESSION_WINDOW_MS).toISOString());
  if ((sessionCount ?? 0) >= PER_SESSION_MAX) return true;

  const { count: businessCount } = await supabase
    .from("widget_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", new Date(now - PER_BUSINESS_WINDOW_MS).toISOString());
  if ((businessCount ?? 0) >= PER_BUSINESS_MAX) return true;

  return false;
}

export async function POST(request: Request, { params }: { params: { widgetKey: string } }) {
  if (!UUID_RE.test(params.widgetKey)) {
    return json({ ok: false, error: "Invalid link." }, 400);
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const sessionId: string | undefined = body?.sessionId;

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return json({ ok: false, error: "Missing session." }, 400);
  }

  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("user_id, business_name, first_name")
    .eq("widget_key", params.widgetKey)
    .maybeSingle();

  if (!profile) {
    return json({ ok: false, error: "This booking link isn't connected to a business." }, 404);
  }

  if (await isRateLimited(supabase, profile.user_id, sessionId)) {
    return json({ ok: false, error: "Too many requests — please try again shortly." }, 429);
  }
  await supabase.from("widget_rate_limit_events").insert({ business_id: profile.user_id, session_id: sessionId });

  if (action === "start") {
    return handleStart(supabase, profile.user_id, body);
  }
  if (action === "check_availability") {
    return handleCheckAvailability(supabase, profile.user_id, body);
  }
  if (action === "confirm") {
    return handleConfirm(supabase, profile, body, new URL(request.url).origin);
  }
  return json({ ok: false, error: "Unknown action." }, 400);
}

// Creates the job as soon as contact/job details are given — same "capture
// first, schedule second" order the phone AI and Messenger already use, so
// checkAvailability/suggestAvailableTimes (which both need a real job to
// exclude from conflict checks) work unmodified.
async function handleStart(supabase: ReturnType<typeof createServiceRoleClient>, businessId: string, body: any) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const addressStreet = typeof body?.addressStreet === "string" ? body.addressStreet.trim() : "";
  const addressSuburb = typeof body?.addressSuburb === "string" ? body.addressSuburb.trim() : "";
  const addressPostcode = typeof body?.addressPostcode === "string" ? body.addressPostcode.trim() : "";
  const jobLabel = typeof body?.jobLabel === "string" ? body.jobLabel.trim() : "";

  if (!name || !phone || !addressStreet || !addressSuburb || !jobLabel) {
    return json({ ok: false, error: "Please fill in all fields." }, 400);
  }

  // Best-effort — a geocode miss still lets the booking go ahead (typed
  // address is kept as-is), it just means travel-time conflict checking
  // won't apply to this particular job, same fallback the phone AI accepts.
  const geocoded = await geocodeAddress({ addressStreet, addressSuburb, addressPostcode: addressPostcode || null });

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      business_id: businessId,
      source: "form",
      customer_name: name,
      customer_phone: phone,
      address_street: geocoded?.addressStreet ?? addressStreet,
      address_suburb: geocoded?.addressSuburb ?? addressSuburb,
      address_postcode: geocoded?.addressPostcode ?? (addressPostcode || null),
      latitude: geocoded?.lat ?? null,
      longitude: geocoded?.lng ?? null,
      job_label: jobLabel,
      // Typed directly by the customer, not transcribed off a phone call —
      // at least as reliable as a High-confidence AI capture.
      confidence: "High",
    })
    .select("id")
    .single();

  if (error || !job) {
    return json({ ok: false, error: "Couldn't save your details — please try again." }, 500);
  }

  return json({ ok: true, jobId: job.id });
}

// Runs all three time-of-day blocks for the chosen date and merges them into
// one flat, chronological list — a customer picks a time, not a block, same
// "just show me what's actually free" experience as Calendly rather than
// making them guess which block to try first.
async function handleCheckAvailability(supabase: ReturnType<typeof createServiceRoleClient>, businessId: string, body: any) {
  const jobId = body?.jobId;
  const date = body?.date;
  if (!jobId || !date) {
    return json({ ok: false, error: "Missing date." }, 400);
  }

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("business_id", businessId).maybeSingle();
  if (!job) {
    return json({ ok: false, error: "Your booking session has expired — please start again." }, 404);
  }

  const [morning, afternoon, evening] = await Promise.all([
    suggestAvailableTimes(supabase, businessId, jobId, date, "Morning"),
    suggestAvailableTimes(supabase, businessId, jobId, date, "Afternoon"),
    suggestAvailableTimes(supabase, businessId, jobId, date, "Evening"),
  ]);

  return json({ ok: true, times: [...morning, ...afternoon, ...evening] });
}

async function handleConfirm(
  supabase: ReturnType<typeof createServiceRoleClient>,
  profile: { user_id: string; business_name: string; first_name: string | null },
  body: any,
  appOrigin: string
) {
  const jobId = body?.jobId;
  const date = body?.date;
  const time = body?.time;
  if (!jobId || !date || !time) {
    return json({ ok: false, error: "Missing date/time." }, 400);
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, customer_name, customer_phone, customer_access_token")
    .eq("id", jobId)
    .eq("business_id", profile.user_id)
    .maybeSingle();
  if (!job) {
    return json({ ok: false, error: "Your booking session has expired — please start again." }, 404);
  }

  // Re-checked here, not just trusted from the earlier suggestion — someone
  // else could have taken this exact slot in the meantime.
  const availability = await checkAvailability(supabase, profile.user_id, jobId, { date, time, block: null });
  if (!availability.available) {
    return json({ ok: false, error: "That time was just taken — please pick another.", retry: true }, 409);
  }

  await rescheduleJob(supabase, jobId, profile.user_id, { date, time, block: null });
  await supabase.from("jobs").update({ status: "Scheduled" }).eq("id", jobId);

  const appointmentLabel = formatAppointmentLabel(date, time, null);

  if (job.customer_phone) {
    const messengerLink = `${appOrigin}/m/${job.customer_access_token}`;
    const message = messageFor(
      "booking_confirmed",
      job.customer_name,
      profile.first_name,
      profile.business_name,
      messengerLink,
      null,
      null,
      null,
      appointmentLabel
    );
    await sendSms(job.customer_phone, message);
    await supabase.from("messages").insert({
      job_id: jobId,
      business_id: profile.user_id,
      sender: "ai",
      body: `Your appointment is confirmed for ${appointmentLabel}.`,
    });
  }

  await notifyOwnerPublicBooking(supabase, profile.user_id, job.customer_name, jobId, appOrigin);

  return json({ ok: true, appointmentLabel });
}
