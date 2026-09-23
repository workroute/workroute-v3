import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { messageFor, formatAppointmentLabel, type NotificationEvent } from "@/lib/notifications";
import { sendSms } from "@/lib/mobile-message";
import { getDrivingInfo, reverseGeocode } from "@/lib/google-maps";

const NOTIFICATION_EVENTS: NotificationEvent[] = ["booking_confirmed", "on_the_way", "running_late", "completed"];

function isNotificationEvent(value: unknown): value is NotificationEvent {
  return typeof value === "string" && (NOTIFICATION_EVENTS as string[]).includes(value);
}

// §13 — sends the real customer SMS. Lives behind a route handler (not
// called directly from the browser) because the Mobile Message credentials
// are secrets that must stay server-side. Scoped to the caller's own job so
// this can't be used to text arbitrary numbers, and only ever sends one of
// the four fixed templates — never client-supplied text. Every send is now
// a one-way invitation into WorkRoute Messenger (§Messenger), not a
// two-way SMS conversation.
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const jobId = body?.jobId;
  const event = body?.event;
  const originLat = typeof body?.originLat === "number" ? body.originLat : null;
  const originLng = typeof body?.originLng === "number" ? body.originLng : null;

  if (typeof jobId !== "string" || !isNotificationEvent(event)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid jobId/event." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "customer_name, customer_phone, customer_access_token, latitude, longitude, job_label, address_street, address_suburb, scheduled_date, scheduled_time, scheduled_block"
    )
    .eq("id", jobId)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }

  if (!job.customer_phone) {
    return NextResponse.json(
      { ok: false, error: "This customer has no phone number on file." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("first_name, business_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const messengerLink = `${new URL(request.url).origin}/m/${job.customer_access_token}`;

  // §41/§42 — real ETA minutes for the "on his way" text, and (§42) a
  // business-km trip log entry, both from the one Distance Matrix call.
  // Origin is the tradie's own current position (a one-time browser
  // location read, not continuous tracking) sent up by the run sheet at the
  // moment "On the way" is tapped — falls back to the old generic wording,
  // and simply logs no trip, whenever coords or the job's own lat/lng
  // aren't available.
  let etaMinutes: number | null = null;
  if (event === "on_the_way" && originLat !== null && originLng !== null && job.latitude !== null && job.longitude !== null) {
    const drivingInfo = await getDrivingInfo(
      { lat: originLat, lng: originLng },
      { lat: job.latitude, lng: job.longitude }
    );
    etaMinutes = drivingInfo?.minutes ?? null;

    if (drivingInfo) {
      const originLabel = await reverseGeocode(originLat, originLng);
      const destinationLabel =
        [job.address_street, job.address_suburb].filter(Boolean).join(", ") || job.customer_name;

      await supabase.from("trip_logs").insert({
        business_id: user.id,
        job_id: jobId,
        trip_date: new Date().toISOString().slice(0, 10),
        origin_label: originLabel,
        destination_label: destinationLabel,
        distance_km: drivingInfo.km,
        reason: job.job_label || "Business - trade service call",
      });
    }
  }

  // §appointment-detail-fix — "Your appointment is confirmed" with no date
  // attached, and nothing written into the Messenger thread either, meant a
  // customer clicking through saw a genuinely empty conversation (found via
  // a real test: the SMS said "confirmed," the link opened to nothing).
  const appointmentLabel =
    event === "booking_confirmed" && job.scheduled_date
      ? formatAppointmentLabel(job.scheduled_date, job.scheduled_time, job.scheduled_block)
      : null;

  const message = messageFor(
    event,
    job.customer_name,
    profile?.first_name || null,
    profile?.business_name || "Your tradie",
    messengerLink,
    etaMinutes,
    null,
    null,
    appointmentLabel
  );
  const result = await sendSms(job.customer_phone, message);

  // Give the Messenger thread itself something real to show, not just the
  // SMS invite — same appointment detail, so clicking through isn't blank.
  if (event === "booking_confirmed" && appointmentLabel) {
    await supabase.from("messages").insert({
      job_id: jobId,
      business_id: user.id,
      sender: "tradie",
      body: `Your appointment is confirmed for ${appointmentLabel}.${job.job_label ? ` (${job.job_label})` : ""}`,
    });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
