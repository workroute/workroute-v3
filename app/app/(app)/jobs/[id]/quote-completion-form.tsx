"use client";

import { useState } from "react";

// §quote-followup — the lightweight completion step for a quote visit
// (job.quote_required), shown instead of CompletionRecap's full invoice
// flow — see app/app/(app)/jobs/[id]/page.tsx for the branch. Just the
// price being quoted, no payment method, no invoice number: nothing's been
// sold yet, Sarah's follow-up call (lib/quote-followup.ts) is what tries to
// actually win the job from here.
export default function QuoteCompletionForm({ jobId }: { jobId: string }) {
  const [quotedPrice, setQuotedPrice] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSend() {
    const priceNumber = Number(quotedPrice);
    if (!quotedPrice || Number.isNaN(priceNumber) || priceNumber < 0) {
      setError("Enter the price you're quoting.");
      return;
    }

    setStatus("sending");
    setError("");

    const response = await fetch(`/api/jobs/${jobId}/send-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quotedPrice: priceNumber, summary: summary.trim() || null }),
    });
    const data = await response.json();

    if (!data.ok) {
      setStatus("error");
      setError(data.error || "Couldn't send that.");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-moss-500/20 bg-moss-500/10 p-4 text-sm text-moss-500">
        <p className="font-medium">Quote sent — ${Number(quotedPrice).toFixed(2)}.</p>
        <p className="mt-1 text-rig-700">
          We'll follow up with the customer shortly to see if they'd like to go ahead.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rig-900/10 bg-white p-4">
      <p className="font-display text-sm font-semibold text-rig-900">Give your quote</p>
      <p className="mt-1 text-xs text-rig-700/70">
        This visit was to have a look and quote the job — enter the price you're quoting. We'll follow up with the
        customer afterwards to see if they'd like to go ahead.
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="field-label">Quote ($)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={quotedPrice}
            onChange={(e) => setQuotedPrice(e.target.value)}
            className="field-input"
            placeholder="e.g. 450"
          />
        </div>
        <div>
          <label className="field-label">Notes (optional)</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="field-input min-h-[60px]"
            placeholder="Anything worth remembering about this quote"
          />
        </div>

        {error && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}

        <button type="button" onClick={handleSend} disabled={status === "sending"} className="btn-primary w-full">
          {status === "sending" ? "Sending…" : "Send quote"}
        </button>
      </div>
    </div>
  );
}
