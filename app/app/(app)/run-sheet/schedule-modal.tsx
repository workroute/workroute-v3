"use client";

import { useState } from "react";
import type { Job } from "@/lib/run-sheet";

const BLOCKS = ["Morning", "Afternoon", "Evening"] as const;

export default function ScheduleModal({
  job,
  onClose,
  onSave,
}: {
  job: Job;
  onClose: () => void;
  onSave: (jobId: string, date: string, time: string | null, block: string | null) => void;
}) {
  const [date, setDate] = useState(job.scheduled_date ?? new Date().toISOString().slice(0, 10));
  const [slotType, setSlotType] = useState<"time" | "block">(job.scheduled_time ? "time" : "block");
  const [time, setTime] = useState(job.scheduled_time?.slice(0, 5) ?? "09:00");
  const [block, setBlock] = useState<string>(job.scheduled_block ?? "Morning");

  function handleSave() {
    if (slotType === "time") {
      onSave(job.id, date, time, null);
    } else {
      onSave(job.id, date, null, block);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rig-950/50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <p className="font-display font-semibold text-rig-900">Schedule job</p>
        <p className="mt-0.5 text-sm text-rig-700">{job.customer_name}</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="field-label">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field-input"
            />
            <p className="mt-1 text-xs text-rig-700/60">
              {new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div>
            <label className="field-label">Time slot</label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSlotType("time")}
                className={`flex-1 rounded border px-3 py-1.5 text-sm ${
                  slotType === "time"
                    ? "border-amber-600 bg-amber-500 text-rig-950"
                    : "border-rig-700/20 bg-white text-rig-700"
                }`}
              >
                Specific time
              </button>
              <button
                type="button"
                onClick={() => setSlotType("block")}
                className={`flex-1 rounded border px-3 py-1.5 text-sm ${
                  slotType === "block"
                    ? "border-amber-600 bg-amber-500 text-rig-950"
                    : "border-rig-700/20 bg-white text-rig-700"
                }`}
              >
                Time-of-day block
              </button>
            </div>

            {slotType === "time" ? (
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="field-input"
              />
            ) : (
              <div className="flex gap-2">
                {BLOCKS.map((b) => (
                  <button
                    type="button"
                    key={b}
                    onClick={() => setBlock(b)}
                    className={`flex-1 rounded border px-3 py-2 text-sm ${
                      block === b
                        ? "border-amber-600 bg-amber-500 text-rig-950"
                        : "border-rig-700/20 bg-white text-rig-700"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn-primary flex-1">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
