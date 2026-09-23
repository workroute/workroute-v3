import type { SupabaseClient } from "@supabase/supabase-js";
import { getDrivingMinutesFromOrigin } from "./google-maps";

export type AvailabilityCheck = {
  date: string; // "YYYY-MM-DD"
  time: string | null; // "HH:MM"
  block: "Morning" | "Afternoon" | "Evening" | null;
};

export type AvailabilityResult =
  | { available: true }
  | { available: false; conflictingCustomerName: string }
  | { available: false; travelConflict: true; nearbyCustomerName: string; driveMinutes: number }
  // §route-flow — only returned for a block-only check (no exact time given).
  // Real candidate times within that block that are actually free, travel
  // time included — lets the AI offer specific options ("I could do 1, 3,
  // or 4:30") instead of asking the caller to guess a time and try again.
  // Empty means genuinely nothing free in that block.
  | { available: false; suggestedTimes: string[] };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

type SameDayJob = {
  id: string;
  customer_name: string;
  scheduled_time: string | null;
  scheduled_block: "Morning" | "Afternoon" | "Evening" | null;
  latitude: number | null;
  longitude: number | null;
  estimated_duration_minutes: number | null;
};

type DayContext = {
  sameDayJobs: SameDayJob[];
  candidateDuration: number;
  // The one real Google Maps call for this whole check/suggestion — a batch
  // of candidate→neighbour drive times, computed once regardless of how many
  // candidate times get evaluated against it (see suggestAvailableTimes).
  // Keyed by neighbour job id; null means that neighbour couldn't be routed
  // (Google Maps miss) rather than "no travel conflict."
  driveMinutesByNeighborId: Map<string, number>;
  geocodedNeighbors: SameDayJob[];
};

async function loadDayContext(
  supabase: SupabaseClient,
  businessId: string,
  excludeJobId: string,
  date: string
): Promise<DayContext> {
  const [{ data: sameDayJobs }, { data: candidate }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, customer_name, scheduled_time, scheduled_block, latitude, longitude, estimated_duration_minutes")
      .eq("business_id", businessId)
      .eq("scheduled_date", date)
      .neq("id", excludeJobId)
      .neq("status", "Completed"),
    supabase.from("jobs").select("latitude, longitude, estimated_duration_minutes").eq("id", excludeJobId).maybeSingle(),
  ]);

  const jobs = sameDayJobs ?? [];
  const candidateDuration = candidate?.estimated_duration_minutes ?? 30;
  const geocodedNeighbors = jobs.filter((j) => j.latitude != null && j.longitude != null && j.scheduled_time);

  const driveMinutesByNeighborId = new Map<string, number>();
  if (candidate?.latitude != null && candidate?.longitude != null && geocodedNeighbors.length > 0) {
    const driveMinutesList = await getDrivingMinutesFromOrigin(
      { lat: candidate.latitude, lng: candidate.longitude },
      geocodedNeighbors.map((j) => ({ lat: j.latitude!, lng: j.longitude! }))
    );
    geocodedNeighbors.forEach((j, i) => {
      const minutes = driveMinutesList[i];
      if (minutes != null) driveMinutesByNeighborId.set(j.id, minutes);
    });
  }

  return { sameDayJobs: jobs, candidateDuration, driveMinutesByNeighborId, geocodedNeighbors };
}

// Pure arithmetic against already-fetched drive times — no API call — so
// this is cheap to run once per candidate time when suggesting a spread of
// options across a block, not just once for a single proposed time.
function findTravelConflictAtTime(candidateMinutes: number, ctx: DayContext): AvailabilityResult | null {
  let before: SameDayJob | null = null;
  let after: SameDayJob | null = null;
  for (const job of ctx.geocodedNeighbors) {
    const jobMinutes = toMinutes(job.scheduled_time!.slice(0, 5));
    if (jobMinutes <= candidateMinutes && (!before || jobMinutes > toMinutes(before.scheduled_time!.slice(0, 5)))) {
      before = job;
    }
    if (jobMinutes >= candidateMinutes && (!after || jobMinutes < toMinutes(after.scheduled_time!.slice(0, 5)))) {
      after = job;
    }
  }

  const neighbors = [before, after].filter(
    (j, i, arr): j is SameDayJob => j !== null && arr.findIndex((n) => n?.id === j.id) === i
  );

  for (const neighbor of neighbors) {
    const driveMinutes = ctx.driveMinutesByNeighborId.get(neighbor.id);
    if (driveMinutes == null) continue;

    const neighborMinutes = toMinutes(neighbor.scheduled_time!.slice(0, 5));
    const isBefore = neighborMinutes <= candidateMinutes;
    const neighborDuration = neighbor.estimated_duration_minutes ?? 30;

    const gapMinutes = isBefore
      ? candidateMinutes - (neighborMinutes + neighborDuration)
      : neighborMinutes - (candidateMinutes + ctx.candidateDuration);

    // A small fixed buffer on top of the raw drive time — real travel
    // (parking, walking to the door) always takes a little longer than
    // Google's point-to-point estimate.
    if (driveMinutes + 10 > gapMinutes) {
      return { available: false, travelConflict: true, nearbyCustomerName: neighbor.customer_name, driveMinutes };
    }
  }

  return null;
}

const BLOCK_RANGES: Record<"Morning" | "Afternoon" | "Evening", [number, number]> = {
  Morning: [toMinutes("07:00"), toMinutes("12:00")],
  Afternoon: [toMinutes("12:00"), toMinutes("17:00")],
  Evening: [toMinutes("17:00"), toMinutes("20:00")],
};

// §Messenger — the AI's `check_availability` tool. First checks for a
// time/block conflict against the business's other jobs on that date, same
// as always. Then, only for an exact time (a block has no precise slot to
// measure a drive against) checks real driving time against whichever job
// sits immediately before and immediately after the requested slot — the
// only two that could actually create a travel conflict, since anything
// further out in the day's schedule has plenty of buffer regardless of
// distance. This is what catches "two jobs an hour apart that are 40
// minutes apart by car," the gap the business owner found by hand (see
// project memory).
//
// §route-flow — a block-only check (no exact time) now runs
// suggestAvailableTimes instead of the old weak "does another job already
// have this exact block" check, which never even considered travel time at
// all. See that function for why this doesn't cost extra Google Maps calls.
export async function checkAvailability(
  supabase: SupabaseClient,
  businessId: string,
  excludeJobId: string,
  { date, time, block }: AvailabilityCheck
): Promise<AvailabilityResult> {
  if (!time && block) {
    const suggestedTimes = await suggestAvailableTimes(supabase, businessId, excludeJobId, date, block);
    return suggestedTimes.length > 0 ? { available: false, suggestedTimes } : { available: false, suggestedTimes: [] };
  }

  const ctx = await loadDayContext(supabase, businessId, excludeJobId, date);

  const conflict = ctx.sameDayJobs.find((job) => {
    if (time) return job.scheduled_time?.slice(0, 5) === time;
    return false;
  });
  if (conflict) {
    return { available: false, conflictingCustomerName: conflict.customer_name };
  }

  if (time) {
    const travelConflict = findTravelConflictAtTime(toMinutes(time), ctx);
    if (travelConflict) return travelConflict;
  }

  return { available: true };
}

// §route-flow — given only a loose block ("Afternoon"), finds real,
// specific candidate times that are actually free — no double-booking, and
// enough real driving time to/from whichever jobs sit either side, the same
// check a specific-time request gets. Only ONE Google Maps call total
// (batched inside loadDayContext) no matter how many candidate times get
// tried below — evaluating each candidate against the already-fetched drive
// times is pure arithmetic.
export async function suggestAvailableTimes(
  supabase: SupabaseClient,
  businessId: string,
  excludeJobId: string,
  date: string,
  block: "Morning" | "Afternoon" | "Evening",
  maxSuggestions = 3
): Promise<string[]> {
  const ctx = await loadDayContext(supabase, businessId, excludeJobId, date);
  const [rangeStart, rangeEnd] = BLOCK_RANGES[block];

  const bookedTimes = new Set(
    ctx.sameDayJobs.filter((j) => j.scheduled_time).map((j) => j.scheduled_time!.slice(0, 5))
  );

  const suggestions: string[] = [];
  for (let minutes = rangeStart; minutes + ctx.candidateDuration <= rangeEnd; minutes += 30) {
    const candidateTime = toHHMM(minutes);
    if (bookedTimes.has(candidateTime)) continue;
    if (findTravelConflictAtTime(minutes, ctx)) continue;

    suggestions.push(candidateTime);
    if (suggestions.length >= maxSuggestions) break;
  }

  return suggestions;
}

// §Messenger — the AI's `reschedule_this_job` tool. Only callable after a
// clean checkAvailability result — that's enforced by the caller in
// lib/messenger-ai.ts, not re-checked here. Appends to the end of the
// target date's existing jobs using the same "max(run_order) + 10" logic
// run-sheet-board.tsx's handleScheduleSave already uses for a manual
// reschedule, so there's one scheduling algorithm, not two that can drift
// apart. Status is left untouched deliberately — this only ever runs on a
// job already past first booking, and shouldn't revert e.g. "On the way"
// back to "Scheduled" just because the time changed.
export async function rescheduleJob(
  supabase: SupabaseClient,
  jobId: string,
  businessId: string,
  { date, time, block }: AvailabilityCheck
): Promise<void> {
  const { data: sameDayJobs } = await supabase
    .from("jobs")
    .select("run_order")
    .eq("business_id", businessId)
    .eq("scheduled_date", date)
    .neq("id", jobId);

  const maxOrder = (sameDayJobs ?? []).reduce((max, j) => Math.max(max, j.run_order ?? 0), 0);

  await supabase
    .from("jobs")
    .update({
      scheduled_date: date,
      scheduled_time: time,
      scheduled_block: block,
      run_order: maxOrder + 10,
    })
    .eq("id", jobId)
    .eq("business_id", businessId);
}
