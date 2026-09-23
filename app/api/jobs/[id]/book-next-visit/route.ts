import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAvailability } from "@/lib/messenger-scheduling";

// §next-visit-on-completion — lets a tradie lock in a repeat customer's next
// visit right from the completion recap, instead of relying on Emma's
// (currently phone-number-blocked) reactivation calling weeks or months
// later. Reuses the exact same checkAvailability the phone/Messenger AI use
// for real availability — this is manual and tradie-triggered, but it should
// never double-book or ignore travel time just because a human clicked it.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const date: string | undefined = body?.date;
  const requestedTime: string | undefined = body?.time;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "A valid date is required." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "client_id, customer_name, customer_phone, address_street, address_suburb, address_postcode, job_label, latitude, longitude, scheduled_time, estimated_duration_minutes"
    )
    .eq("id", params.id)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }

  // A repeat visit for the same customer is almost always the same time of
  // day — only ask the tradie to pick one if this job never had a time
  // either, since there's nothing sensible to default to.
  const time = requestedTime || job.scheduled_time?.slice(0, 5) || null;

  if (time) {
    const availability = await checkAvailability(supabase, user.id, params.id, { date, time, block: null });
    if (!availability.available) {
      if ("conflictingCustomerName" in availability) {
        return NextResponse.json({
          ok: false,
          error: `That time's already booked for ${availability.conflictingCustomerName} — pick another.`,
        });
      }
      if ("travelConflict" in availability) {
        return NextResponse.json({
          ok: false,
          error: `Too tight after the job before it (${availability.driveMinutes} min drive) — pick another time.`,
        });
      }
      return NextResponse.json({ ok: false, error: "That time isn't free — pick another." });
    }
  }

  const { data: sameDayJobs } = await supabase
    .from("jobs")
    .select("run_order")
    .eq("business_id", user.id)
    .eq("scheduled_date", date);
  const maxOrder = (sameDayJobs ?? []).reduce((max, j) => Math.max(max, j.run_order ?? 0), 0);

  const { data: created, error } = await supabase
    .from("jobs")
    .insert({
      business_id: user.id,
      client_id: job.client_id,
      source: "form",
      customer_name: job.customer_name,
      customer_phone: job.customer_phone,
      address_street: job.address_street,
      address_suburb: job.address_suburb,
      address_postcode: job.address_postcode,
      job_label: job.job_label,
      latitude: job.latitude,
      longitude: job.longitude,
      estimated_duration_minutes: job.estimated_duration_minutes,
      confidence: "High",
      status: "Scheduled",
      scheduled_date: date,
      scheduled_time: time,
      run_order: maxOrder + 10,
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Couldn't create the next visit." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, jobId: created.id, date, time });
}
