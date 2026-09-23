"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS_STYLES, OUTCOME_STYLES, derivedOutcome, statusLabel } from "@/lib/run-sheet";
import { initials } from "@/lib/avatar";

export type JobRow = {
  id: string;
  customer_name: string;
  job_label: string | null;
  status: "Unscheduled" | "Scheduled" | "On the way" | "Running late" | "Completed";
  outcome: "Won" | "Lost" | "Declined" | null;
  quote_required: boolean;
  estimated_price: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_block: "Morning" | "Afternoon" | "Evening" | null;
};

function formatSlot(job: JobRow): string | null {
  if (job.scheduled_time) {
    const [h, m] = job.scheduled_time.split(":").map(Number);
    const period = h >= 12 ? "pm" : "am";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")}${period}`;
  }
  return job.scheduled_block;
}

// §32e — Total/Upcoming/Today/Completed, derived purely from existing
// status/scheduled_date columns — no new schema. Mutually exclusive so the
// three category counts always sum to Total.
type Category = "Upcoming" | "Today" | "Completed";
const CATEGORIES: Category[] = ["Upcoming", "Today", "Completed"];

function categoryOf(job: JobRow, today: string): Category {
  if (job.status === "Completed") return "Completed";
  if (job.scheduled_date === today) return "Today";
  return "Upcoming";
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(row: JobRow): string {
  if (row.quote_required) return "Quote required";
  if (row.estimated_price === null) return "—";
  return `$${Number(row.estimated_price).toFixed(2)}`;
}

export default function JobsTable({ rows }: { rows: JobRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "Total">("Total");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { Upcoming: 0, Today: 0, Completed: 0 };
    for (const r of rows) c[categoryOf(r, today)]++;
    return c;
  }, [rows, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "Total" && categoryOf(r, today) !== category) return false;
      if (q && !r.customer_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, category, today]);

  return (
    <div className="mt-6">
      {rows.length > 0 && (
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-paper-100 p-1">
          {(["Total", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
                category === c ? "bg-white text-rig-900 shadow-sm" : "text-rig-700 hover:text-rig-900"
              }`}
            >
              {c} ({c === "Total" ? rows.length : counts[c]})
            </button>
          ))}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="field-input max-w-sm"
        placeholder="Search by customer name…"
      />

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-rig-900/10 bg-white p-6 text-center text-sm text-rig-700/60 shadow-sm">
          No jobs yet —{" "}
          <Link href="/app/jobs/new" className="font-medium text-steel-500 hover:underline">
            capture your first one
          </Link>
          .
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-lg border border-rig-900/10 bg-white p-6 text-center text-sm text-rig-700/60 shadow-sm">
          {query ? `No jobs match "${query}".` : `No ${category.toLowerCase()} jobs.`}
        </p>
      ) : (
        <>
          {/* §32 — mobile card list is the primary presentation now, not a
              table squeezed into a narrow viewport. */}
          <div className="mt-4 space-y-3 sm:hidden">
            {filtered.map((job) => {
              // §32 — "Won" is dropped here per the redesign brief (more
              // relevant to quotes than every completed job); still shown
              // on the job detail page via OutcomeActions.
              const outcome = derivedOutcome(job);
              const showOutcome = outcome && outcome !== "Won";
              return (
                <Link
                  key={job.id}
                  href={`/app/jobs/${job.id}`}
                  className="block rounded-lg border border-rig-900/10 bg-white p-4 shadow-sm hover:bg-paper-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-xs font-semibold text-rig-700">
                        {initials(job.customer_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display font-semibold text-rig-900">{job.customer_name}</p>
                        {job.job_label && <p className="truncate text-xs text-rig-700">{job.job_label}</p>}
                      </div>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-rig-700">
                    <span>
                      {formatDate(job.scheduled_date)}
                      {formatSlot(job) ? ` · ${formatSlot(job)}` : ""}
                    </span>
                    {job.quote_required && (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 font-medium text-amber-600">
                        Quote required
                      </span>
                    )}
                    {showOutcome && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${OUTCOME_STYLES[outcome as Exclude<typeof outcome, null>]}`}
                      >
                        {outcome}
                      </span>
                    )}
                  </div>
                  {!job.quote_required && (
                    <p className="mt-1 text-sm font-medium text-rig-900">{formatPrice(job)}</p>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-lg border border-rig-900/10 bg-white shadow-sm sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rig-900/10 text-xs uppercase tracking-wide text-rig-700/70">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Outcome</th>
                  <th className="px-4 py-3 font-medium">Scheduled</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const outcome = derivedOutcome(job);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => router.push(`/app/jobs/${job.id}`)}
                      className="cursor-pointer border-b border-rig-900/5 last:border-0 hover:bg-paper-100"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-xs font-semibold text-rig-700">
                            {initials(job.customer_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-rig-900">{job.customer_name}</p>
                            {job.job_label && <p className="truncate text-xs text-rig-700">{job.job_label}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}
                        >
                          {statusLabel(job.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {outcome ? (
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${OUTCOME_STYLES[outcome]}`}
                          >
                            {outcome}
                          </span>
                        ) : (
                          <span className="text-rig-700/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-rig-700">
                        {formatDate(job.scheduled_date)}
                        {formatSlot(job) ? ` · ${formatSlot(job)}` : ""}
                      </td>
                      <td className="px-4 py-3 text-rig-700">{formatPrice(job)}</td>
                      <td className="px-4 py-3 text-right text-rig-700/40" aria-hidden="true">
                        ›
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
