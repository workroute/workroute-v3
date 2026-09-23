"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// §54 — before/after photos for any job, regardless of how it was booked
// (phone, widget, or manually captured) — previously only the manual "New
// Job" form could attach a photo at all, so a phone-booked job (most real
// bookings) had no photo option whatsoever. Two purposes per the business
// owner's own prior real-world experience: proof of work done, and cover
// for the tradie if a customer who wasn't home later claims something was
// damaged. Reuses the existing "job-photos" storage bucket and the
// pre-existing arrival_photo_* columns for "before" — only completion_photo_*
// is new.
type Slot = "arrival" | "completion";

function Photo({
  jobId,
  businessId,
  slot,
  label,
  initialUrl,
  initialTakenAt,
}: {
  jobId: string;
  businessId: string;
  slot: Slot;
  label: string;
  initialUrl: string | null;
  initialTakenAt: string | null;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [takenAt, setTakenAt] = useState(initialTakenAt);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const now = new Date();
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${businessId}/${jobId}/${slot}-${now.getTime()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const column = slot === "arrival" ? "arrival_photo_path" : "completion_photo_path";
    const takenAtColumn = slot === "arrival" ? "arrival_photo_taken_at" : "completion_photo_taken_at";
    const { error: updateError } = await supabase
      .from("jobs")
      .update({ [column]: path, [takenAtColumn]: now.toISOString() })
      .eq("id", jobId);

    if (updateError) {
      setError(updateError.message);
      setUploading(false);
      return;
    }

    setUrl(URL.createObjectURL(file));
    setTakenAt(now.toISOString());
    setUploading(false);
  }

  return (
    <div>
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-steel-500">{label}</p>
      {url ? (
        <>
          <img src={url} alt={label} className="w-full rounded object-cover" />
          {takenAt && (
            <p className="mt-1 text-xs text-rig-700/60">
              Taken {new Date(takenAt).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })}
            </p>
          )}
        </>
      ) : (
        <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-rig-700/25 bg-paper-100 py-6 text-sm text-rig-700/60 hover:bg-paper-100/70">
          {uploading ? "Uploading…" : `📷 Add ${label.toLowerCase()}`}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleSelect}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-rust-500">{error}</p>}
    </div>
  );
}

export default function JobPhotos({
  jobId,
  businessId,
  arrivalPhotoUrl,
  arrivalPhotoTakenAt,
  completionPhotoUrl,
  completionPhotoTakenAt,
}: {
  jobId: string;
  businessId: string;
  arrivalPhotoUrl: string | null;
  arrivalPhotoTakenAt: string | null;
  completionPhotoUrl: string | null;
  completionPhotoTakenAt: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-rig-900/10 pt-4 sm:grid-cols-2">
      <Photo
        jobId={jobId}
        businessId={businessId}
        slot="arrival"
        label="Before photo"
        initialUrl={arrivalPhotoUrl}
        initialTakenAt={arrivalPhotoTakenAt}
      />
      <Photo
        jobId={jobId}
        businessId={businessId}
        slot="completion"
        label="After photo"
        initialUrl={completionPhotoUrl}
        initialTakenAt={completionPhotoTakenAt}
      />
    </div>
  );
}
