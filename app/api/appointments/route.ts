import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAvailability, suggestAvailableTimes, rescheduleJob } from "@/lib/messenger-scheduling";
import { TRADE_QUESTIONS, isFixedLocationTrade } from "@/lib/trade-questions";

// Salon / massage front-desk booking: the owner or staff member adds an
// appointment (walk-in, phone-in, or a regular booking again after their
// cut) in one request. Same scheduling rules as Sarah and the public
// booking page (lib/messenger-scheduling.ts), so a chair-aware "is this
// slot full?" answer is the same everywhere. A full slot returns the nearest
// free times instead of failing silently; the owner can still force it
// ("book anyway") for a squeeze-in.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ ok: false, error: "Please sign in again." }, 401);

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const time = typeof body?.time === "string" ? body.time : "";
  const force = body?.force === true;
  const tradeAnswers = body?.tradeAnswers && typeof body.tradeAnswers === "object" ? body.tradeAnswers : {};
  const duration = Number.isFinite(body?.durationMinutes) ? Math.min(600, Math.max(5, Math.round(body.durationMinutes))) : null;
  const price = body?.price != null && body.price !== "" && Number.isFinite(Number(body.price)) ? Number(body.price) : null;

  if (!name) return json({ ok: false, error: "Please enter the client's name." }, 400);
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return json({ ok: false, error: "Please pick a date and time." }, 400);

  const { data: profile } = await supabase.from("business_profiles").select("trade").eq("user_id", user.id).maybeSingle();
  if (!profile || !isFixedLocationTrade(profile.trade)) {
    return json({ ok: false, error: "Appointments are for salon and massage businesses." }, 400);
  }

  // Existing client (verified to be this business's own) or a new one.
  let clientId: string | null = null;
  if (typeof body?.clientId === "string" && body.clientId) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("id", body.clientId)
      .eq("business_id", user.id)
      .maybeSingle();
    clientId = existing?.id ?? null;
  }
  if (!clientId) {
    const { data: created, error: clientError } = await supabase
      .from("clients")
      .insert({ business_id: user.id, name, phone: phone || null })
      .select("id")
      .single();
    if (clientError || !created) return json({ ok: false, error: "Couldn't save the client. Try again." }, 500);
    clientId = created.id;
  }

  // A short label for the run sheet, taken from the first select question
  // (service / massage type) so it reads "Cut and colour" rather than blank.
  const firstSelect = (TRADE_QUESTIONS[profile.trade] ?? []).find((q) => q.type === "select");
  const label = firstSelect && typeof tradeAnswers[firstSelect.id] === "string" ? tradeAnswers[firstSelect.id] : null;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      business_id: user.id,
      client_id: clientId,
      source: "form",
      customer_name: name,
      customer_phone: phone || null,
      job_label: label,
      trade_answers: tradeAnswers,
      estimated_duration_minutes: duration,
      estimated_price: price,
      quote_required: false,
      confidence: "High",
    })
    .select("id")
    .single();
  if (jobError || !job) return json({ ok: false, error: "Couldn't save the appointment. Try again." }, 500);

  if (!force) {
    const availability = await checkAvailability(supabase, user.id, job.id, { date, time, block: null });
    if (!availability.available) {
      const [morning, afternoon, evening] = await Promise.all([
        suggestAvailableTimes(supabase, user.id, job.id, date, "Morning", 20),
        suggestAvailableTimes(supabase, user.id, job.id, date, "Afternoon", 20),
        suggestAvailableTimes(supabase, user.id, job.id, date, "Evening", 20),
      ]);
      const wanted = toMinutes(time);
      const nearest = [...morning, ...afternoon, ...evening]
        .sort((a, b) => Math.abs(toMinutes(a) - wanted) - Math.abs(toMinutes(b) - wanted))
        .slice(0, 4)
        .sort();
      // Nothing was booked, so don't leave a half-made appointment behind.
      // The client record is kept (and returned) so a retry doesn't duplicate them.
      await supabase.from("jobs").delete().eq("id", job.id).eq("business_id", user.id);
      return json({ ok: false, conflict: true, suggestions: nearest, clientId });
    }
  }

  await rescheduleJob(supabase, job.id, user.id, { date, time, block: null });
  await supabase.from("jobs").update({ status: "Scheduled" }).eq("id", job.id).eq("business_id", user.id);

  return json({ ok: true, jobId: job.id, clientId });
}
