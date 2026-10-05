import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAvailability, rescheduleJob } from "./messenger-scheduling";
import { sendCustomerSms } from "./mobile-message";
import { messageFor, formatAppointmentLabel } from "./notifications";
import { notifyOwnerSlotFilled } from "./push-notifications";
import { TRADE_QUESTIONS, isFixedLocationTrade, staffPreference } from "./trade-questions";

// "Sarah fills the gap" (salons / massage). When an appointment is cancelled,
// clients with LATER bookings get a text offering to move up into the freed
// time. First to tap wins, and the time they leave behind can be offered on
// in turn (capped, so one cancellation can't snowball). There's deliberately
// no waiting list: it only ever uses bookings people already made.
//
// All times in this app are Brisbane local (no daylight saving), so slot
// instants are built with a fixed +10:00 offset.

const MIN_LEAD_MINUTES = 90; // a client needs time to get there
const MAX_OFFERS_PER_SLOT = 3;
const LOOKAHEAD_DAYS = 14;
const MAX_CHAIN_DEPTH = 2; // original gap + up to two knock-on gaps
const MAX_OFFER_LIFETIME_MS = 12 * 60 * 60 * 1000;
const CLOSE_BEFORE_SLOT_MS = 60 * 60 * 1000;
const TEXT_FROM_HOUR = 7; // Brisbane local, inclusive
const TEXT_UNTIL_HOUR = 20; // exclusive

export type Slot = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  staff: string | null; // the stylist the freed appointment was with, if any
};

export function slotStartMs(date: string, time: string): number {
  return Date.parse(`${date}T${time.slice(0, 5)}:00+10:00`);
}

function brisbaneHourNow(): number {
  return Number(
    new Intl.DateTimeFormat("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Brisbane" }).format(new Date())
  );
}

function brisbaneToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

type Candidate = {
  id: string;
  client_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  scheduled_date: string;
  scheduled_time: string;
  estimated_duration_minutes: number | null;
  trade_answers: Record<string, any> | null;
};

export type FillResult = { offered: number; reason?: string };

export async function fillGap(
  supabase: SupabaseClient,
  params: { businessId: string; slot: Slot; sourceJobId: string; appOrigin: string; depth?: number }
): Promise<FillResult> {
  const { businessId, slot, sourceJobId, appOrigin } = params;
  const depth = params.depth ?? 0;
  if (depth > MAX_CHAIN_DEPTH) return { offered: 0, reason: "chain limit reached" };

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("business_name, trade")
    .eq("user_id", businessId)
    .maybeSingle();
  if (!profile || !isFixedLocationTrade(profile.trade)) return { offered: 0, reason: "not a salon business" };

  const startMs = slotStartMs(slot.date, slot.time);
  if (startMs - Date.now() < MIN_LEAD_MINUTES * 60 * 1000) return { offered: 0, reason: "too close to the start time" };

  const hour = brisbaneHourNow();
  if (hour < TEXT_FROM_HOUR || hour >= TEXT_UNTIL_HOUR) return { offered: 0, reason: "outside texting hours (7am to 8pm)" };

  const pref = staffPreference(profile.trade);
  const mainQuestion = (TRADE_QUESTIONS[profile.trade] ?? []).find((q) => q.type === "select");

  // Later, still-scheduled bookings that have a phone number.
  const { data: rows } = await supabase
    .from("jobs")
    .select("id, client_id, customer_name, customer_phone, scheduled_date, scheduled_time, estimated_duration_minutes, trade_answers")
    .eq("business_id", businessId)
    .eq("status", "Scheduled")
    .not("scheduled_time", "is", null)
    .not("customer_phone", "is", null)
    .gte("scheduled_date", slot.date)
    .lte("scheduled_date", addDays(brisbaneToday(), LOOKAHEAD_DAYS))
    .neq("id", sourceJobId);

  let candidates = ((rows ?? []) as Candidate[]).filter(
    (c) => c.customer_phone && slotStartMs(c.scheduled_date, c.scheduled_time) > startMs
  );
  if (candidates.length === 0) return { offered: 0, reason: "no later bookings to move" };

  // Not clients who opted out, and not anyone already holding an open offer.
  const clientIds = candidates.map((c) => c.client_id).filter((id): id is string => !!id);
  const [{ data: optedOut }, { data: openOffers }] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id").in("id", clientIds).eq("gap_offers_opt_out", true)
      : Promise.resolve({ data: [] as { id: string }[] }),
    supabase
      .from("slot_offers")
      .select("job_id")
      .eq("business_id", businessId)
      .eq("status", "offered")
      .gt("expires_at", new Date().toISOString()),
  ]);
  const optedOutIds = new Set((optedOut ?? []).map((c) => c.id));
  const busyJobIds = new Set((openOffers ?? []).map((o) => o.job_id));
  candidates = candidates.filter((c) => !(c.client_id && optedOutIds.has(c.client_id)) && !busyJobIds.has(c.id));

  // The booking has to fit the gap, and if they asked for a particular
  // stylist, only offer it when the freed time was with that same person.
  candidates = candidates.filter((c) => {
    if ((c.estimated_duration_minutes || 60) > slot.durationMinutes) return false;
    const wanted = pref ? c.trade_answers?.[pref.questionId] : null;
    if (!wanted || wanted === "No preference") return true;
    return !!slot.staff && wanted === slot.staff;
  });

  // Rank: same service first, then whoever is furthest away (moving them
  // leaves the biggest gap behind, which has the most time to refill).
  const { data: source } = await supabase.from("jobs").select("trade_answers").eq("id", sourceJobId).maybeSingle();
  const sourceService = mainQuestion ? source?.trade_answers?.[mainQuestion.id] : null;
  const score = (c: Candidate) => {
    const sameService = mainQuestion && sourceService && c.trade_answers?.[mainQuestion.id] === sourceService ? 1 : 0;
    return sameService * 1_000_000 + slotStartMs(c.scheduled_date, c.scheduled_time) / 1_000_000;
  };
  candidates.sort((a, b) => score(b) - score(a));

  // One offer per client/phone, and only where the slot is genuinely open
  // for them (chair-aware, same rule Sarah and the booking page use).
  const chosen: Candidate[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = c.client_id ?? c.customer_phone!;
    if (seen.has(key)) continue;
    const availability = await checkAvailability(supabase, businessId, c.id, { date: slot.date, time: slot.time, block: null });
    if (!availability.available) continue;
    seen.add(key);
    chosen.push(c);
    if (chosen.length >= MAX_OFFERS_PER_SLOT) break;
  }
  if (chosen.length === 0) return { offered: 0, reason: "nobody suitable to offer it to" };

  const batchId = crypto.randomUUID();
  const expiresAt = new Date(Math.min(startMs - CLOSE_BEFORE_SLOT_MS, Date.now() + MAX_OFFER_LIFETIME_MS));
  const slotLabel = formatAppointmentLabel(slot.date, slot.time, null);

  let offered = 0;
  for (const c of chosen) {
    const { data: offer, error } = await supabase
      .from("slot_offers")
      .insert({
        business_id: businessId,
        job_id: c.id,
        source_job_id: sourceJobId,
        batch_id: batchId,
        slot_date: slot.date,
        slot_time: slot.time.slice(0, 5),
        slot_duration_minutes: slot.durationMinutes,
        slot_staff: slot.staff,
        depth,
        expires_at: expiresAt.toISOString(),
      })
      .select("token")
      .single();
    if (error || !offer) {
      console.error("[gap-fill] couldn't create offer —", error?.message);
      continue;
    }

    const currentLabel = formatAppointmentLabel(c.scheduled_date, c.scheduled_time, null);
    const message =
      `Hi ${firstName(c.customer_name)}, a spot just opened up at ${profile.business_name} on ${slotLabel}. ` +
      `Want to move your ${currentLabel} appointment up to it? Tap to take it: ${appOrigin}/slot/${offer.token} ` +
      `If you don't, nothing changes.`;
    const sent = await sendCustomerSms(supabase, businessId, c.customer_phone!, message);
    if (sent.ok) {
      offered += 1;
    } else {
      console.error("[gap-fill] offer text failed —", sent.error);
      await supabase.from("slot_offers").update({ status: "expired" }).eq("token", offer.token);
    }
  }

  return { offered, ...(offered === 0 ? { reason: "the offer texts couldn't be sent" } : {}) };
}

export type ClaimResult =
  | { ok: true; label: string }
  | { ok: false; state: "taken" | "expired" | "gone" | "error" };

// Called from the public "tap to take it" page. Safe against two people
// tapping at once: the unique index on (batch_id) where status='claimed'
// only lets one update through.
export async function claimOffer(supabase: SupabaseClient, token: string, appOrigin: string): Promise<ClaimResult> {
  const { data: offer } = await supabase
    .from("slot_offers")
    .select("id, business_id, job_id, batch_id, slot_date, slot_time, slot_duration_minutes, depth, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!offer) return { ok: false, state: "gone" };
  if (offer.status !== "offered") return { ok: false, state: "taken" };
  if (new Date(offer.expires_at).getTime() < Date.now()) {
    await supabase.from("slot_offers").update({ status: "expired" }).eq("id", offer.id).eq("status", "offered");
    return { ok: false, state: "expired" };
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, customer_name, customer_phone, customer_access_token, scheduled_date, scheduled_time, estimated_duration_minutes, trade_answers")
    .eq("id", offer.job_id)
    .eq("business_id", offer.business_id)
    .maybeSingle();
  if (!job || job.status !== "Scheduled" || !job.scheduled_date || !job.scheduled_time) return { ok: false, state: "gone" };
  if (slotStartMs(offer.slot_date, offer.slot_time) - Date.now() < 30 * 60 * 1000) return { ok: false, state: "expired" };

  // Take the slot. The unique index turns away a second claimant.
  const { data: won, error: claimError } = await supabase
    .from("slot_offers")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .eq("id", offer.id)
    .eq("status", "offered")
    .select("id")
    .maybeSingle();
  if (claimError || !won) return { ok: false, state: "taken" };

  // Still open? Someone may have booked the time through another route.
  const availability = await checkAvailability(supabase, offer.business_id, job.id, {
    date: offer.slot_date,
    time: offer.slot_time.slice(0, 5),
    block: null,
  });
  if (!availability.available) {
    await supabase.from("slot_offers").update({ status: "expired" }).eq("id", offer.id);
    return { ok: false, state: "taken" };
  }

  const oldDate: string = job.scheduled_date;
  const oldTime: string = job.scheduled_time;
  await rescheduleJob(supabase, job.id, offer.business_id, { date: offer.slot_date, time: offer.slot_time.slice(0, 5), block: null });

  await supabase
    .from("slot_offers")
    .update({ status: "superseded" })
    .eq("batch_id", offer.batch_id)
    .eq("status", "offered");

  const label = formatAppointmentLabel(offer.slot_date, offer.slot_time.slice(0, 5), null);
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("business_name, first_name, trade")
    .eq("user_id", offer.business_id)
    .maybeSingle();

  if (job.customer_phone && profile) {
    const text = messageFor(
      "booking_confirmed",
      job.customer_name,
      profile.first_name,
      profile.business_name,
      `${appOrigin}/m/${job.customer_access_token}`,
      null,
      null,
      null,
      label
    );
    await sendCustomerSms(supabase, offer.business_id, job.customer_phone, text);
    await supabase.from("messages").insert({
      job_id: job.id,
      business_id: offer.business_id,
      sender: "ai",
      body: `Your appointment has moved up to ${label}.`,
    });
  }
  await notifyOwnerSlotFilled(supabase, offer.business_id, job.customer_name, label, job.id, appOrigin).catch(() => {});

  // The time they left is now free, so offer it on (best effort).
  try {
    const pref = profile ? staffPreference(profile.trade) : null;
    const staff = pref ? (job.trade_answers?.[pref.questionId] ?? null) : null;
    await fillGap(supabase, {
      businessId: offer.business_id,
      slot: {
        date: oldDate,
        time: oldTime.slice(0, 5),
        durationMinutes: job.estimated_duration_minutes || 60,
        staff: staff && staff !== "No preference" ? staff : null,
      },
      sourceJobId: job.id,
      appOrigin,
      depth: offer.depth + 1,
    });
  } catch (error) {
    console.error("[gap-fill] knock-on offer failed —", error);
  }

  return { ok: true, label };
}

export async function declineOffer(supabase: SupabaseClient, token: string, optOut: boolean): Promise<void> {
  const { data: offer } = await supabase
    .from("slot_offers")
    .select("id, job_id, business_id, status")
    .eq("token", token)
    .maybeSingle();
  if (!offer) return;
  if (offer.status === "offered") {
    await supabase.from("slot_offers").update({ status: "declined" }).eq("id", offer.id);
  }
  if (optOut) {
    const { data: job } = await supabase
      .from("jobs")
      .select("client_id")
      .eq("id", offer.job_id)
      .eq("business_id", offer.business_id)
      .maybeSingle();
    if (job?.client_id) {
      await supabase.from("clients").update({ gap_offers_opt_out: true }).eq("id", job.client_id).eq("business_id", offer.business_id);
    }
  }
}
