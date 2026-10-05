"use client";

import Link from "next/link";
import { useState } from "react";

// Salon / massage: cancel an appointment and, optionally, offer the freed
// time to clients with later bookings (lib/gap-fill.ts). Two taps on purpose
// (button, then confirm) so a cancellation can't happen by accident.
export default function CancelAppointment({ jobId, customerName }: { jobId: string; customerName: string }) {
  const [open, setOpen] = useState(false);
  const [offerGap, setOfferGap] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ offered: number; reason: string | null } | null>(null);

  async function confirmCancel() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/appointments/${jobId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerGap }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!data?.ok) {
      setError(data?.error ?? "Something went wrong. Please try again.");
      return;
    }
    setResult({ offered: data.offered ?? 0, reason: data.reason ?? null });
  }

  if (result) {
    return (
      <div className="mt-4 rounded-lg bg-paper-100 p-4 text-sm text-rig-700">
        <p className="font-medium text-rig-900">Cancelled.</p>
        <p className="mt-1">
          {!offerGap
            ? "The time is free again."
            : result.offered > 0
              ? `Offered the time to ${result.offered} client${result.offered === 1 ? "" : "s"} with later bookings. We'll let you know if someone takes it.`
              : `Nobody was texted${result.reason ? ` (${result.reason})` : ""}. The time is free again.`}
        </p>
        <Link href="/app/run-sheet" className="mt-2 inline-block font-medium text-steel-500 hover:underline">
          Back to today
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded border border-rust-500/40 bg-white px-4 py-2.5 text-sm font-medium text-rust-500 hover:bg-rust-500/5"
      >
        Cancel appointment
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-rust-500/30 bg-rust-500/5 p-4">
      <p className="text-sm font-medium text-rig-900">Cancel {customerName}&apos;s appointment?</p>
      <label className="mt-3 flex items-start gap-2 text-sm text-rig-700">
        <input
          type="checkbox"
          checked={offerGap}
          onChange={(e) => setOfferGap(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-rig-700/30"
        />
        <span>Offer this time to clients with later bookings. They get a text and can tap to move up.</span>
      </label>
      {error && <p className="mt-3 rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={confirmCancel}
          className="flex-1 rounded bg-rust-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="flex-1 rounded border border-rig-700/20 bg-white px-4 py-2.5 text-sm font-medium text-rig-900"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
