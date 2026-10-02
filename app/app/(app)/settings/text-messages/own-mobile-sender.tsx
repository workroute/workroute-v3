"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = { phone: string | null; isMobile: boolean; active: boolean };

export default function OwnMobileSender() {
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<"idle" | "sending" | "sent" | "checking">("idle");
  const [error, setError] = useState("");
  const [stillWaiting, setStillWaiting] = useState(false);

  async function loadStatus() {
    const res = await fetch("/api/sms-sender", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setError(data?.error ?? "Couldn't check your text settings — try again.");
      return null;
    }
    setStatus(data);
    return data as Status;
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleSend() {
    setStep("sending");
    setError("");
    const res = await fetch("/api/sms-sender", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setStep("idle");
      setError(data?.error ?? "Something went wrong — try again.");
      return;
    }
    setStep("sent");
  }

  async function handleCheck() {
    setStep("checking");
    setStillWaiting(false);
    const latest = await loadStatus();
    setStep("sent");
    if (latest && !latest.active) setStillWaiting(true);
  }

  if (!status) {
    return <p className="text-sm text-rig-700">{error || "Checking…"}</p>;
  }

  if (status.active) {
    return (
      <div className="space-y-2">
        <p className="font-display font-semibold text-rig-900">✓ Texts come from your mobile</p>
        <p className="text-sm text-rig-700">
          Booking confirmations, &quot;on my way&quot; texts and reminders are sent from {status.phone}. When a
          customer replies, it comes straight to your phone.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-display font-semibold text-rig-900">Send texts from your own mobile</p>
        <p className="text-sm text-rig-700">
          Right now your customers get texts from a shared WorkRoute number, so if they hit reply, you won&apos;t
          see it. Switch to your own mobile and replies come straight to you.
        </p>
      </div>

      {!status.isMobile ? (
        <p className="text-sm text-rig-700">
          First, add your mobile number (starting 04) in{" "}
          <Link href="/app/profile" className="font-medium text-steel-500 hover:underline">
            Business details
          </Link>
          .
        </p>
      ) : step === "idle" || step === "sending" ? (
        <button
          type="button"
          onClick={handleSend}
          disabled={step === "sending"}
          className="w-full rounded-lg bg-rig-900 px-4 py-3 font-display font-semibold text-white disabled:opacity-60"
        >
          {step === "sending" ? "Sending…" : `Use my mobile (${status.phone})`}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-rig-900">
            We&apos;ve texted a link to {status.phone}. Open that text and tap the link to confirm, then come back
            here.
          </p>
          <button
            type="button"
            onClick={handleCheck}
            disabled={step === "checking"}
            className="w-full rounded-lg bg-rig-900 px-4 py-3 font-display font-semibold text-white disabled:opacity-60"
          >
            {step === "checking" ? "Checking…" : "I've tapped the link"}
          </button>
          {stillWaiting && (
            <p className="text-sm text-rig-700">
              Not confirmed yet. Make sure you tapped the link in the text, wait a few seconds, then try again.{" "}
              <button type="button" onClick={handleSend} className="font-medium text-steel-500 hover:underline">
                Send the text again
              </button>
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
