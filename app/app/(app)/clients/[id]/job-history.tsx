import Link from "next/link";
import { STATUS_STYLES, OUTCOME_STYLES, derivedOutcome, statusLabel, type Job, type Outcome } from "@/lib/run-sheet";

export type JobHistoryRow = {
  id: string;
  scheduled_date: string | null;
  created_at: string;
  status: Job["status"];
  estimated_price: number | null;
  quote_required: boolean;
  outcome: Job["outcome"];
  trade: string | null;
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(job: JobHistoryRow): string {
  if (job.quote_required && job.estimated_price === null) return "Quote required";
  if (job.estimated_price === null) return "—";
  return `$${job.estimated_price.toFixed(2)}`;
}

export default function JobHistory({ jobs }: { jobs: JobHistoryRow[] }) {
  if (jobs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-rig-700/25 bg-paper-100 p-4 text-sm text-rig-700/60">
        No jobs captured for this client yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/app/jobs/${job.id}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-rig-900/10 bg-white p-3 text-sm shadow-sm hover:bg-paper-100"
        >
          <div>
            <p className="font-medium text-rig-900">
              {formatDate(job.scheduled_date ?? job.created_at)}
            </p>
            {job.trade && <p className="text-xs text-rig-700/70">{job.trade}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-rig-700">{formatPrice(job)}</span>
            <span
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}
            >
              {statusLabel(job.status)}
            </span>
            {derivedOutcome(job) && (
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${OUTCOME_STYLES[derivedOutcome(job) as Outcome]}`}
              >
                {derivedOutcome(job)}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
