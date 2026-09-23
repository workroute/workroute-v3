"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Job } from "@/lib/run-sheet";
import {
  STATUS_ACTIONS,
  STATUS_ACTION_LABELS,
  STATUS_STYLES,
  OUTCOME_STYLES,
  derivedOutcome,
  isOverdue,
  statusLabel,
} from "@/lib/run-sheet";
import { initials } from "@/lib/avatar";

export function formatSlot(job: Job) {
  if (job.scheduled_time) return job.scheduled_time.slice(0, 5);
  if (job.scheduled_block) return job.scheduled_block;
  return null;
}

export default function JobCard({
  job,
  draggable,
  onStatusChange,
  onSchedule,
}: {
  job: Job;
  draggable: boolean;
  onStatusChange: (jobId: string, status: Job["status"]) => void;
  onSchedule: (job: Job) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const address = [job.address_street, job.address_suburb].filter(Boolean).join(", ");
  const slot = formatSlot(job);
  const overdue = isOverdue(job);
  const isQuoteVisit = job.quote_required && job.status !== "Unscheduled";
  const outcome = derivedOutcome(job);
  const isNew = Date.now() - new Date(job.created_at).getTime() < 24 * 60 * 60 * 1000;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-rig-900/10 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {draggable && (
            <button
              {...attributes}
              {...listeners}
              type="button"
              aria-label="Drag to reorder"
              className="mt-0.5 cursor-grab touch-none px-1 text-rig-700/40 hover:text-rig-700 active:cursor-grabbing"
            >
              ⠿
            </button>
          )}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-xs font-semibold text-rig-700">
            {initials(job.customer_name)}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-display font-semibold text-rig-900">{job.customer_name}</p>
              {isNew && (
                <span className="rounded-full bg-steel-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-steel-500">
                  New
                </span>
              )}
            </div>
            {job.job_label && <p className="text-sm text-rig-700">{job.job_label}</p>}
            {address && <p className="text-sm text-rig-700">{address}</p>}
          </div>
        </div>
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}
        >
          {statusLabel(job.status)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {slot && (
          <span className="rounded bg-paper-100 px-2 py-0.5 font-mono text-xs text-rig-700">
            {slot}
          </span>
        )}
        {isQuoteVisit && (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
            Quote visit
          </span>
        )}
        {job.recurring_frequency && (
          <span className="rounded bg-steel-500/15 px-2 py-0.5 text-xs font-medium text-steel-500">
            🔁 {job.recurring_frequency}
          </span>
        )}
        {overdue && (
          <span className="rounded bg-rust-500/15 px-2 py-0.5 text-xs font-medium text-rust-500">
            Overdue
          </span>
        )}
        {outcome && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_STYLES[outcome]}`}
          >
            {outcome}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {job.status === "Unscheduled" && (
          <button
            type="button"
            onClick={() => onSchedule(job)}
            className="rounded border border-rig-700/20 bg-white px-3 py-1.5 text-xs font-medium text-rig-900 hover:bg-paper-100"
          >
            Schedule
          </button>
        )}

        {/* §32 — Reschedule and Declined/Lost moved to the job detail page;
            this card only shows the day's execution actions now. */}
        {STATUS_ACTIONS[job.status].map((nextStatus) => (
          <button
            key={nextStatus}
            type="button"
            onClick={() => onStatusChange(job.id, nextStatus)}
            className="btn-primary px-3 py-1.5 text-xs"
          >
            {STATUS_ACTION_LABELS[nextStatus] ?? nextStatus}
          </button>
        ))}
      </div>
    </div>
  );
}
