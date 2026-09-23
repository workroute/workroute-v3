"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// §Invoice chase — WorkRoute has no payment processor, so this is the only
// signal that an outstanding bank-transfer/invoice-later invoice was
// actually paid. Setting invoice_paid_at is what stops both the week-1 SMS
// reminder and the week-2 phone-call escalation (see lib/invoice-chase.ts).
export default function InvoicePaidToggle({
  jobId,
  initialPaidAt,
}: {
  jobId: string;
  initialPaidAt: string | null;
}) {
  const [paidAt, setPaidAt] = useState(initialPaidAt);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const next = paidAt ? null : new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase.from("jobs").update({ invoice_paid_at: next }).eq("id", jobId);
    if (!error) setPaidAt(next);
    setSaving(false);
  }

  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      <span className={`text-sm font-medium ${paidAt ? "text-moss-500" : "text-amber-600"}`}>
        {paidAt
          ? `Paid ${new Date(paidAt).toLocaleDateString("en-AU", { timeZone: "Australia/Brisbane" })}`
          : "Not yet marked as paid"}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="text-sm font-medium text-steel-500 hover:underline"
      >
        {saving ? "Saving…" : paidAt ? "Mark as unpaid" : "Mark as paid"}
      </button>
    </div>
  );
}
