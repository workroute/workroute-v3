"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import type { Job, BucketKey } from "@/lib/run-sheet";
import { NOTIFY_ON_STATUS, STATUS_STYLES, statusLabel } from "@/lib/run-sheet";
import type { NotificationEvent } from "@/lib/notifications";
import { buildGoogleMapsUrl, buildGoogleMapsEmbedUrl } from "@/lib/maps";
import { initials } from "@/lib/avatar";
import JobCard, { formatSlot } from "./job-card";
import ScheduleModal from "./schedule-modal";

const STATUS_TO_EVENT: Partial<Record<Job["status"], NotificationEvent>> = {
  "On the way": "on_the_way",
  "Running late": "running_late",
  Completed: "completed",
};

// §13 — real SMS via Mobile Message, sent through /api/notify (never
// directly from the browser — that route holds the actual credentials).
// Every send is now a one-way invitation into WorkRoute Messenger, not a
// two-way SMS conversation (§Messenger).
// §41 — a single, one-time location read (not continuous background
// tracking) taken at the exact moment "On the way" is tapped, purely to
// compute a real ETA for that one text. Resolves to null on denial/timeout/
// unsupported browsers rather than rejecting — a missing ETA just falls
// back to the old generic "on his way" wording, never blocks the status
// change itself.
function getCurrentPositionOnce(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

async function sendNotification(
  jobId: string,
  customerName: string,
  event: NotificationEvent,
  label: string,
  origin: { lat: number; lng: number } | null
): Promise<string> {
  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, event, originLat: origin?.lat ?? null, originLng: origin?.lng ?? null }),
    });
    const data = await res.json();
    return data.ok
      ? `Texted ${customerName}: "${label}" update sent.`
      : `Couldn't text ${customerName}: ${data.error ?? "unknown error"}`;
  } catch {
    return `Couldn't text ${customerName}: network error.`;
  }
}

function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function RunSheetBoard({
  initialBuckets,
}: {
  initialBuckets: Record<BucketKey, Job[]>;
}) {
  const [buckets, setBuckets] = useState(initialBuckets);
  const [schedulingJob, setSchedulingJob] = useState<Job | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function findBucketOf(jobId: string): BucketKey | null {
    for (const key of Object.keys(buckets) as BucketKey[]) {
      if (buckets[key].some((j) => j.id === jobId)) return key;
    }
    return null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const list = buckets.today;
    const oldIndex = list.findIndex((j) => j.id === active.id);
    const newIndex = list.findIndex((j) => j.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...list];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Reassign run_order sequentially and persist. Optimistic UI update
    // first, then write through.
    const withNewOrder = reordered.map((job, i) => ({ ...job, run_order: (i + 1) * 10 }));
    setBuckets((prev) => ({ ...prev, today: withNewOrder }));

    const supabase = createClient();
    await Promise.all(
      withNewOrder.map((job) =>
        supabase.from("jobs").update({ run_order: job.run_order }).eq("id", job.id)
      )
    );
  }

  async function handleStatusChange(jobId: string, nextStatus: Job["status"]) {
    const bucketKey = findBucketOf(jobId);
    if (!bucketKey) return;
    const job = buckets[bucketKey].find((j) => j.id === jobId);
    if (!job) return;

    // §20 — Completed always means Won, set automatically, not a separate step.
    const outcome: Job["outcome"] = nextStatus === "Completed" ? "Won" : job.outcome;

    setBuckets((prev) => ({
      ...prev,
      [bucketKey]: prev[bucketKey].map((j) =>
        j.id === jobId ? { ...j, status: nextStatus, outcome } : j
      ),
    }));

    const supabase = createClient();
    await supabase.from("jobs").update({ status: nextStatus, outcome }).eq("id", jobId);

    const event = STATUS_TO_EVENT[nextStatus];
    if (NOTIFY_ON_STATUS.includes(nextStatus) && event) {
      const origin = nextStatus === "On the way" ? await getCurrentPositionOnce() : null;
      setNotice(await sendNotification(jobId, job.customer_name, event, nextStatus, origin));
      setTimeout(() => setNotice(null), 4000);
    }
  }

  async function handleScheduleSave(
    jobId: string,
    date: string,
    time: string | null,
    block: string | null
  ) {
    const supabase = createClient();

    const fromBucket = findBucketOf(jobId);
    const job = fromBucket ? buckets[fromBucket].find((j) => j.id === jobId) : null;
    if (!job) return;

    const today = new Date().toISOString().slice(0, 10);
    const isToday = date <= today;
    const wasUnscheduled = job.status === "Unscheduled";
    const nextStatus = wasUnscheduled ? "Scheduled" : job.status;

    // §32 — Run Sheet only tracks "unscheduled" and "today" locally now.
    // Scheduling a job for any other date removes it from what's on screen
    // (it surfaces on Jobs/Calendar instead) — the toast below exists so
    // that doesn't read as the action silently failing.
    setBuckets((prev) => {
      const next = { ...prev };
      if (fromBucket) {
        next[fromBucket] = next[fromBucket].filter((j) => j.id !== jobId);
      }
      if (isToday) {
        const targetList = next.today.filter((j) => j.id !== jobId);
        const maxOrder = targetList.reduce((m, j) => Math.max(m, j.run_order ?? 0), 0);
        next.today = [
          ...targetList,
          {
            ...job,
            scheduled_date: date,
            scheduled_time: time,
            scheduled_block: block as Job["scheduled_block"],
            status: nextStatus,
            run_order: maxOrder + 10,
          },
        ];
      }
      return next;
    });

    await supabase
      .from("jobs")
      .update({ scheduled_date: date, scheduled_time: time, scheduled_block: block, status: nextStatus })
      .eq("id", jobId);

    if (isToday) {
      const finalOrder = buckets.today.reduce((m, j) => Math.max(m, j.run_order ?? 0), 0) + 10;
      await supabase.from("jobs").update({ run_order: finalOrder }).eq("id", jobId);
    }

    setSchedulingJob(null);

    // §Messenger — booking-confirmed invitation SMS, fired once, only on the
    // first-ever scheduling of this job. A later reschedule of an
    // already-Scheduled job deliberately doesn't re-send it.
    if (wasUnscheduled) {
      setNotice(await sendNotification(jobId, job.customer_name, "booking_confirmed", "Booking confirmed", null));
      setTimeout(() => setNotice(null), 4000);
    } else if (!isToday) {
      setNotice(`Scheduled for ${formatDayLabel(date)} — see it on Jobs or Calendar.`);
      setTimeout(() => setNotice(null), 4000);
    }
  }

  const todayJobs = buckets.today;
  const nextJob = todayJobs.find((j) => j.status !== "Completed") ?? null;
  const nextJobAddress = nextJob
    ? [nextJob.address_street, nextJob.address_suburb].filter(Boolean).join(", ")
    : "";
  const locationCount = new Set(
    todayJobs
      .map((j) => [j.address_suburb, j.address_postcode].filter(Boolean).join("|"))
      .filter(Boolean)
  ).size;
  const mapsUrl = buildGoogleMapsUrl(todayJobs);
  // §Google Maps integration — an at-a-glance embedded picture of today's
  // run, not a navigation tool (the "Open in Google Maps" link above still
  // owns the actual drive). Requires the separate, browser-restricted
  // NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (never the server-only one used for
  // geocoding) — quietly renders nothing if that's not configured, rather
  // than showing a broken iframe.
  const mapsEmbedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapsEmbedUrl = mapsEmbedKey ? buildGoogleMapsEmbedUrl(todayJobs, mapsEmbedKey) : null;

  return (
    <div className="mt-6">
      {notice && (
        <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-rig-900">
          {notice}
        </div>
      )}

      {/* §32f — a highlighted, read-only summary of today's first
          not-yet-completed job. Deliberately no action buttons here (those
          live on the matching card below) — this is an at-a-glance
          highlight, not a second set of controls. */}
      {nextJob && (
        <Link
          href={`/app/jobs/${nextJob.id}`}
          className="mb-6 block rounded-lg border-2 border-amber-500 bg-amber-500/10 p-4 shadow-sm hover:bg-amber-500/15"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-amber-600">Next Job</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-semibold text-amber-600">
              {initials(nextJob.customer_name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-display font-semibold text-rig-900">{nextJob.customer_name}</p>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[nextJob.status]}`}
                >
                  {statusLabel(nextJob.status)}
                </span>
              </div>
              <p className="truncate text-sm text-rig-700">
                {[formatSlot(nextJob), nextJob.job_label || nextJobAddress].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* §11 — jobs land here as soon as they're captured (§10 default:
          Unscheduled) and stay here until a date/slot is assigned. Kept
          visually distinct from the run sheet below: different surface,
          horizontal tray rather than a day column, no drag handle (order
          doesn't matter until a job has a date to be ordered within). */}
      <section className="rounded-lg border border-dashed border-rig-700/25 bg-paper-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-widest text-rig-700">
            Quotes · {buckets.unscheduled.length}
          </p>
          <p className="text-xs text-rig-700/70">Follow these up and give them a date</p>
        </div>
        {buckets.unscheduled.length === 0 ? (
          <p className="text-sm text-rig-700/60">
            Nothing waiting — every captured job has a date.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {buckets.unscheduled.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                draggable={false}
                onStatusChange={handleStatusChange}
                onSchedule={setSchedulingJob}
              />
            ))}
          </div>
        )}
      </section>

      {/* §32 — Run Sheet is today-only: what am I doing today, in what
          order. Numbered stops reflect the existing suggested/manual sort
          order (§12), not a real calculated route (§32b). */}
      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-steel-500">Today's run</p>
          <p className="text-sm text-rig-700">
            {todayJobs.length} {todayJobs.length === 1 ? "job" : "jobs"}
            {locationCount > 0
              ? ` · ${locationCount} ${locationCount === 1 ? "location" : "locations"}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded border border-rig-700/20 bg-white px-3 py-1.5 text-sm font-medium text-rig-900 hover:bg-paper-100"
            >
              Open in Google Maps
            </a>
          )}
          <Link
            href="/app/jobs/new"
            className="inline-flex items-center justify-center rounded bg-amber-500 px-3 py-1.5 font-display text-sm font-semibold text-rig-950 transition hover:bg-amber-600"
          >
            + New Job
          </Link>
        </div>
      </div>

      {mapsEmbedUrl && (
        <div className="mb-6 overflow-hidden rounded-lg border border-rig-700/10 shadow-sm">
          <iframe
            title="Today's run map"
            src={mapsEmbedUrl}
            width="100%"
            height="260"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={todayJobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {todayJobs.map((job, i) => (
              <div key={job.id} className="flex items-start gap-3">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rig-900 font-mono text-xs font-semibold text-paper-50">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <JobCard
                    job={job}
                    draggable
                    onStatusChange={handleStatusChange}
                    onSchedule={setSchedulingJob}
                  />
                </div>
              </div>
            ))}
            {todayJobs.length === 0 && (
              <p className="text-sm text-rig-700/60">
                No jobs scheduled — enjoy the quiet before the next one.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {schedulingJob && (
        <ScheduleModal
          job={schedulingJob}
          onClose={() => setSchedulingJob(null)}
          onSave={handleScheduleSave}
        />
      )}
    </div>
  );
}
