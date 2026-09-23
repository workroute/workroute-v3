"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OUTCOME_STYLES, derivedOutcome, type Job, type Outcome } from "@/lib/run-sheet";

// §20 — mark Lost/Declined from the job detail view. Completed jobs always
// read as Won (see derivedOutcome) so there's nothing to set there.
export default function OutcomeActions({
  jobId,
  status,
  initialOutcome,
}: {
  jobId: string;
  status: Job["status"];
  initialOutcome: Job["outcome"];
}) {
  const [outcome, setOutcome] = useState(initialOutcome);
  const [saving, setSaving] = useState(false);

  const displayed = derivedOutcome({ status, outcome });

  async function setAndSave(next: Job["outcome"]) {
    setSaving(true);
    setOutcome(next);
    const supabase = createClient();
    await supabase.from("jobs").update({ outcome: next }).eq("id", jobId);
    setSaving(false);
  }

  if (status === "Completed") {
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${OUTCOME_STYLES.Won}`}>
        Won
      </span>
    );
  }

  if (displayed) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${OUTCOME_STYLES[displayed as Outcome]}`}
        >
          {displayed}
        </span>
        <button
          type="button"
          disabled={saving}
          onClick={() => setAndSave(null)}
          className="text-xs font-medium text-steel-500 hover:underline disabled:opacity-50"
        >
          Clear outcome
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={saving}
        onClick={() => setAndSave("Declined")}
        className="rounded border border-rig-700/20 bg-white px-3 py-1.5 text-xs font-medium text-rig-700 hover:bg-paper-100 disabled:opacity-50"
      >
        Mark Declined
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => setAndSave("Lost")}
        className="rounded border border-rust-500/30 bg-white px-3 py-1.5 text-xs font-medium text-rust-500 hover:bg-rust-500/10 disabled:opacity-50"
      >
        Mark Lost
      </button>
    </div>
  );
}
