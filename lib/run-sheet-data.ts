import type { SupabaseClient } from "@supabase/supabase-js";
import { bucketFor, sortBucket, type Job, type BucketKey } from "./run-sheet";

// §12/§27 — shared by the standalone run sheet page and the dashboard,
// which both need the identical fetch-bucket-backfill logic. Extracted
// once both needed it, rather than duplicated across two page files.
export async function getRunSheetBuckets(
  supabase: SupabaseClient,
  businessId: string
): Promise<Record<BucketKey, Job[]>> {
  const today = new Date().toISOString().slice(0, 10);

  // §32 — Run Sheet is today-only, so this now excludes future-dated jobs
  // entirely (they surface via Jobs/Calendar instead). Still folds in
  // overdue non-completed jobs (so they don't just disappear) and today's
  // completed jobs (so a finished day still shows what got done), without
  // dragging in the full completed job history the old `status.neq.Completed`
  // clause used to pull in regardless of date.
  const { data: jobsData } = await supabase
    .from("jobs")
    .select(
      "id, customer_name, job_label, address_street, address_suburb, address_postcode, latitude, longitude, status, quote_required, recurring_frequency, scheduled_date, scheduled_time, scheduled_block, run_order, outcome, customer_access_token, ai_paused, attention_priority, created_at"
    )
    .eq("business_id", businessId)
    .or(
      `status.eq.Unscheduled,and(status.neq.Completed,scheduled_date.lte.${today}),and(status.eq.Completed,scheduled_date.eq.${today})`
    );

  const jobs = (jobsData ?? []) as Job[];

  // Group into buckets, then assign a suggested run_order to any job that
  // doesn't have one yet, so the first view of a day is already sorted and
  // every subsequent drag has a stable base to work from.
  const buckets: Record<BucketKey, Job[]> = {
    unscheduled: [],
    today: [],
  };
  for (const job of jobs) {
    buckets[bucketFor(job)].push(job);
  }

  const updates: { id: string; run_order: number }[] = [];
  (Object.keys(buckets) as BucketKey[]).forEach((key) => {
    const sorted = sortBucket(buckets[key]);
    let nextOrder = 10;
    const maxExisting = sorted.reduce(
      (max, j) => (j.run_order !== null ? Math.max(max, j.run_order) : max),
      0
    );
    nextOrder = maxExisting + 10;
    sorted.forEach((job) => {
      if (job.run_order === null) {
        job.run_order = nextOrder;
        updates.push({ id: job.id, run_order: nextOrder });
        nextOrder += 10;
      }
    });
    buckets[key] = sorted;
  });

  if (updates.length > 0) {
    await Promise.all(
      updates.map((u) => supabase.from("jobs").update({ run_order: u.run_order }).eq("id", u.id))
    );
  }

  return buckets;
}
