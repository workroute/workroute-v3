"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// §trial-limits — the one manual step standing in for a real payment
// webhook (owner's chosen flow: convert via an external payment link,
// no automation yet). Calls the owner-only mark-paying route and
// refreshes the page so the trial badge updates immediately.
export default function MarkPayingButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleClick() {
    setStatus("saving");
    const res = await fetch(`/api/admin/businesses/${businessId}/mark-paying`, { method: "POST" });
    const data = await res.json();
    if (!data.ok) {
      setStatus("error");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "saving"}
      className="rounded border border-rig-700/20 bg-white px-2.5 py-1 text-xs font-medium text-rig-900 hover:bg-paper-100 disabled:opacity-50"
    >
      {status === "saving" ? "Saving…" : status === "error" ? "Failed — retry" : "Mark as paying"}
    </button>
  );
}
