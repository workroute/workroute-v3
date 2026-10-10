"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TABLET_DELIVERY_DAYS } from "@/lib/tablet-offer";

// §tablet-offer — one tap once the tablet is in the post. Starts the
// business's free trial on the expected delivery day, so the days the
// tablet spends in the mail don't count against it.
export default function TabletSentButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleClick() {
    setStatus("saving");
    const res = await fetch(`/api/admin/businesses/${businessId}/tablet-sent`, { method: "POST" });
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
      title={`Trial will start ${TABLET_DELIVERY_DAYS} days from now, when the tablet should arrive`}
      className="rounded border border-rig-700/20 bg-white px-2.5 py-1 text-xs font-medium text-rig-900 hover:bg-paper-100 disabled:opacity-50"
    >
      {status === "saving" ? "Saving…" : status === "error" ? "Failed — retry" : "Tablet posted"}
    </button>
  );
}
