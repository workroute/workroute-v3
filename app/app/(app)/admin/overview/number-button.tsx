"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// §spare-numbers — "Give a spare number" for a business with none, or
// "Release number" to put theirs back in stock (it rests 30 days first).
export default function NumberButton({ businessId, hasNumber }: { businessId: string; hasNumber: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");

  async function handleClick() {
    if (hasNumber && !window.confirm("Take this number off the business and put it back in stock? Sarah will stop answering calls to it.")) {
      return;
    }
    setStatus("saving");
    setError("");
    const res = await fetch(`/api/admin/businesses/${businessId}/number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: hasNumber ? "release" : "assign" }),
    });
    const data = await res.json();
    if (!data.ok) {
      setStatus("idle");
      setError(data.error ?? "Failed.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "saving"}
        className="rounded border border-rig-700/20 bg-white px-2.5 py-1 text-xs font-medium text-rig-900 hover:bg-paper-100 disabled:opacity-50"
      >
        {status === "saving" ? "Working…" : hasNumber ? "Release number" : "Give a spare number"}
      </button>
      {error && <span className="text-xs text-rust-500">{error}</span>}
    </>
  );
}
