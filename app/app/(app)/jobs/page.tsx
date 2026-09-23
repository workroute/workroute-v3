import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JobsTable, { type JobRow } from "./jobs-table";

// Every job regardless of status — distinct from /run-sheet, which
// deliberately excludes old completed jobs to stay focused on active work.
export default async function JobsPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // §32 — Calendar's day-drill-down (and anything else wanting "jobs on a
  // specific date") lands here via ?date=, since Jobs is the one place that
  // shows every status, not just what's on today's run sheet.
  const date = searchParams.date;
  let query = supabase
    .from("jobs")
    .select(
      "id, customer_name, job_label, status, outcome, quote_required, estimated_price, scheduled_date, scheduled_time, scheduled_block"
    )
    .eq("business_id", user.id);
  query = date ? query.eq("scheduled_date", date) : query;
  const { data: jobsData } = await query.order("created_at", { ascending: false });

  let rows = (jobsData ?? []) as JobRow[];

  // §47 — when drilling into a single day (from Calendar), order by when
  // the job is actually booked, not when it was captured — created_at order
  // made a day's jobs appear in a seemingly random sequence with no visible
  // time at all, since scheduled_time/scheduled_block weren't even fetched
  // before this. Block-only jobs get a representative time (Morning=9am,
  // Afternoon=1pm, Evening=5pm) purely for sort position, never displayed.
  if (date) {
    const blockMinutes: Record<string, number> = { Morning: 9 * 60, Afternoon: 13 * 60, Evening: 17 * 60 };
    const sortKey = (job: JobRow): number => {
      if (job.scheduled_time) {
        const [h, m] = job.scheduled_time.split(":").map(Number);
        return h * 60 + m;
      }
      if (job.scheduled_block && job.scheduled_block in blockMinutes) return blockMinutes[job.scheduled_block];
      return Infinity;
    };
    rows = [...rows].sort((a, b) => sortKey(a) - sortKey(b));
  }

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-rig-900">Jobs</h1>
            <p className="mt-1 text-sm text-rig-700">
              Every job you've captured, regardless of status.
            </p>
          </div>
          <Link href="/app/jobs/new" className="btn-primary whitespace-nowrap">
            + New Job
          </Link>
        </div>

        {date && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="rounded-full bg-steel-500/10 px-3 py-1 font-medium text-steel-500">
              Showing jobs for{" "}
              {new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <Link href="/app/jobs" className="text-rig-700 hover:underline">
              × Clear
            </Link>
          </div>
        )}

        <JobsTable rows={rows} />
      </div>
    </main>
  );
}
