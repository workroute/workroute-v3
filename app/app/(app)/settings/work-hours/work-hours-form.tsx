"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function WorkHoursForm({
  userId,
  initialStart,
  initialEnd,
}: {
  userId: string;
  initialStart: string | null;
  initialEnd: string | null;
}) {
  const [start, setStart] = useState(initialStart?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(initialEnd?.slice(0, 5) ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase
      .from("business_profiles")
      .update({ work_start_time: start || null, work_end_time: end || null })
      .eq("user_id", userId);

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-rig-700">
        Used to work out how much room is left in a day — e.g. Calendar's capacity view.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Start time</label>
          <input
            type="time"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setStatus("idle");
            }}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">End time</label>
          <input
            type="time"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setStatus("idle");
            }}
            className="field-input"
          />
        </div>
      </div>

      {status === "error" && (
        <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
      )}
      {status === "saved" && <p className="text-sm text-moss-500">Saved.</p>}

      <button type="submit" disabled={status === "saving"} className="btn-primary">
        {status === "saving" ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
