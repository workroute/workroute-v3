import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fillGap } from "@/lib/gap-fill";
import { isFixedLocationTrade, staffPreference } from "@/lib/trade-questions";

// Cancel an appointment (salon / massage). The row is kept as "Cancelled" so
// the client's history stays intact, but it stops counting everywhere that
// matters (diary, availability). Optionally offers the freed time to clients
// with later bookings (lib/gap-fill.ts), which is the point of cancelling here
// rather than just deleting.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const offerGap = body?.offerGap !== false;

  const { data: profile } = await supabase.from("business_profiles").select("trade").eq("user_id", user.id).maybeSingle();
  if (!profile || !isFixedLocationTrade(profile.trade)) {
    return NextResponse.json({ ok: false, error: "Cancelling is for salon and massage appointments." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, scheduled_date, scheduled_time, estimated_duration_minutes, trade_answers")
    .eq("id", params.id)
    .eq("business_id", user.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ ok: false, error: "Appointment not found." }, { status: 404 });
  if (job.status === "Cancelled") return NextResponse.json({ ok: false, error: "Already cancelled." }, { status: 409 });
  if (job.status === "Completed") return NextResponse.json({ ok: false, error: "That appointment is already complete." }, { status: 409 });

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "Cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("business_id", user.id);
  if (updateError) return NextResponse.json({ ok: false, error: "Couldn't cancel it. Try again." }, { status: 500 });

  // Nothing to offer for a booking with no exact time.
  if (!offerGap || !job.scheduled_date || !job.scheduled_time) {
    return NextResponse.json({ ok: true, offered: 0 });
  }

  const pref = staffPreference(profile.trade);
  const staff = pref ? (job.trade_answers?.[pref.questionId] ?? null) : null;
  try {
    const result = await fillGap(createServiceRoleClient(), {
      businessId: user.id,
      slot: {
        date: job.scheduled_date,
        time: job.scheduled_time.slice(0, 5),
        durationMinutes: job.estimated_duration_minutes || 60,
        staff: staff && staff !== "No preference" ? staff : null,
      },
      sourceJobId: job.id,
      appOrigin: new URL(request.url).origin,
    });
    return NextResponse.json({ ok: true, offered: result.offered, reason: result.reason ?? null });
  } catch (error) {
    console.error("[cancel] gap fill failed —", error);
    // The cancellation itself already went through.
    return NextResponse.json({ ok: true, offered: 0, reason: "couldn't send the offers" });
  }
}
