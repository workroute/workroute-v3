"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/lib/run-sheet";
import ScheduleModal from "../../run-sheet/schedule-modal";

// §32 — Reschedule moved off the run sheet job card (which now only shows
// today's execution actions) onto the job detail page instead. Reuses the
// same ScheduleModal as the run sheet rather than a second date/time UI.
export default function RescheduleAction({ job }: { job: Job }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSave(jobId: string, date: string, time: string | null, block: string | null) {
    const supabase = createClient();
    await supabase
      .from("jobs")
      .update({ scheduled_date: date, scheduled_time: time, scheduled_block: block })
      .eq("id", jobId);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-rig-700/20 bg-white px-3 py-1.5 text-xs font-medium text-rig-900 hover:bg-paper-100"
      >
        Reschedule
      </button>
      {open && <ScheduleModal job={job} onClose={() => setOpen(false)} onSave={handleSave} />}
    </>
  );
}
