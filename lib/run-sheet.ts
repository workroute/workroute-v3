// §12 — shared logic for grouping and ordering jobs on the run sheet.

export type Job = {
  id: string;
  customer_name: string;
  job_label: string | null;
  address_street: string | null;
  address_suburb: string | null;
  address_postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "Unscheduled" | "Scheduled" | "On the way" | "Running late" | "Completed";
  quote_required: boolean;
  recurring_frequency: "Weekly" | "Fortnightly" | "Monthly" | null;
  scheduled_date: string | null; // "YYYY-MM-DD"
  scheduled_time: string | null; // "HH:MM:SS"
  scheduled_block: "Morning" | "Afternoon" | "Evening" | null;
  run_order: number | null;
  outcome: "Won" | "Lost" | "Declined" | null;
  customer_access_token: string;
  ai_paused: boolean;
  attention_priority: "low" | "medium" | "high" | null;
  created_at: string;
};

export type BucketKey = "unscheduled" | "today";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// §32 — Run Sheet is today-only now. The query in run-sheet-data.ts already
// restricts results to unscheduled jobs or scheduled_date <= today, so
// anything reaching this function is either today or overdue — both "today"
// here, matching the old "overdue folds into today" behavior.
export function bucketFor(job: Job): BucketKey {
  return job.scheduled_date ? "today" : "unscheduled";
}

export function isOverdue(job: Job): boolean {
  return !!job.scheduled_date && job.scheduled_date < todayStr() && job.status !== "Completed";
}

// §12: "Sorted by suburb/postcode, then street (alphabetical) — suggested
// ordering only." Used to seed run_order the first time a job appears on
// the board; after that, the tradie's drag order (run_order) wins.
export function suggestedSortValue(job: Job): string {
  return [job.address_suburb ?? "", job.address_postcode ?? "", job.address_street ?? ""]
    .join("|")
    .toLowerCase();
}

export function sortBucket(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aHas = a.run_order !== null;
    const bHas = b.run_order !== null;
    if (aHas && bHas) return (a.run_order as number) - (b.run_order as number);
    if (aHas) return -1;
    if (bHas) return 1;
    return suggestedSortValue(a).localeCompare(suggestedSortValue(b));
  });
}

// §10 status flow: which buttons should show for a job's current status.
export const STATUS_ACTIONS: Record<Job["status"], Job["status"][]> = {
  Unscheduled: [], // handled by the "Schedule" action instead, not a status button
  Scheduled: ["On the way", "Running late", "Completed"],
  "On the way": ["Running late", "Completed"],
  "Running late": ["On the way", "Completed"],
  Completed: [],
};

// §32 — display-only label override for run sheet action buttons. Keeps the
// underlying status value ("Running late") and DB check constraint
// unchanged; only the button text reads "Delayed" per the mobile redesign.
export const STATUS_ACTION_LABELS: Partial<Record<Job["status"], string>> = {
  "Running late": "Delayed",
};

// §13: which status changes should trigger a customer SMS (sent via Mobile
// Message — see /api/notify and lib/notifications.ts).
export const NOTIFY_ON_STATUS: Job["status"][] = ["On the way", "Running late", "Completed"];

// §quote-label — "Unscheduled" read as a confusing scheduling toggle rather
// than something meaningful to follow up on. Same pattern as
// STATUS_ACTION_LABELS above: the underlying status value and DB check
// constraint stay "Unscheduled" everywhere (no migration, no touching
// run-sheet-data.ts/phone-ai.ts filtering) — only the text shown to the
// tradie changes, to "Quote".
export const STATUS_LABELS: Partial<Record<Job["status"], string>> = {
  Unscheduled: "Quote",
};

export function statusLabel(status: Job["status"]): string {
  return STATUS_LABELS[status] ?? status;
}

// Shared status badge colours — run sheet job cards and the client job
// history list (§19) both need to render the same status pill.
export const STATUS_STYLES: Record<Job["status"], string> = {
  Unscheduled: "bg-rig-700/10 text-rig-700",
  Scheduled: "bg-steel-500/10 text-steel-500",
  "On the way": "bg-amber-500/15 text-amber-600",
  "Running late": "bg-rust-500/10 text-rust-500",
  Completed: "bg-moss-500/10 text-moss-500",
};

// §20 — job outcome tracking. A lightweight terminal marker alongside the
// status flow above, not a new set of stages. "Completed" always means
// "Won" — derivedOutcome() makes that true everywhere without needing a
// stored value, so it holds even for jobs completed before this existed.
export type Outcome = NonNullable<Job["outcome"]>;

export function derivedOutcome(job: Pick<Job, "status" | "outcome">): Job["outcome"] {
  return job.outcome ?? (job.status === "Completed" ? "Won" : null);
}

export const OUTCOME_STYLES: Record<Outcome, string> = {
  Won: "bg-moss-500/10 text-moss-500",
  Lost: "bg-rust-500/10 text-rust-500",
  Declined: "bg-rig-700/10 text-rig-700",
};
