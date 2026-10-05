"use client";

import { useState } from "react";

type State = "idle" | "busy" | "moved" | "taken" | "kept" | "optedOut" | "error";

export default function SlotActions({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");
  const [movedLabel, setMovedLabel] = useState("");

  async function send(action: "claim" | "decline" | "optout") {
    setState("busy");
    const response = await fetch(`/api/slot/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);

    if (action === "claim") {
      if (data?.ok) {
        setMovedLabel(data.label ?? "");
        setState("moved");
      } else if (data?.state === "taken" || data?.state === "expired" || data?.state === "gone") {
        setState("taken");
      } else {
        setState("error");
      }
      return;
    }
    setState(data?.ok ? (action === "optout" ? "optedOut" : "kept") : "error");
  }

  if (state === "moved") {
    return (
      <div className="mt-5 rounded-lg bg-moss-500/10 p-4 text-center">
        <p className="font-display font-semibold text-rig-900">You're moved up</p>
        <p className="mt-1 text-sm text-rig-700">{movedLabel ? `See you ${movedLabel}.` : "See you then."} We've sent you a confirmation text.</p>
      </div>
    );
  }
  if (state === "taken") {
    return (
      <div className="mt-5 rounded-lg bg-amber-500/10 p-4 text-center">
        <p className="font-display font-semibold text-rig-900">Sorry, that spot just went</p>
        <p className="mt-1 text-sm text-rig-700">Your original appointment hasn't changed.</p>
      </div>
    );
  }
  if (state === "kept" || state === "optedOut") {
    return (
      <div className="mt-5 rounded-lg bg-paper-100 p-4 text-center">
        <p className="font-display font-semibold text-rig-900">No problem</p>
        <p className="mt-1 text-sm text-rig-700">
          {state === "optedOut" ? "We won't text you about earlier spots again. " : ""}Your original appointment stays as it is.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {state === "error" && (
        <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">Something went wrong. Please try again.</p>
      )}
      <button type="button" disabled={state === "busy"} onClick={() => send("claim")} className="btn-primary w-full">
        {state === "busy" ? "One moment…" : "Yes, move me up"}
      </button>
      <button
        type="button"
        disabled={state === "busy"}
        onClick={() => send("decline")}
        className="w-full rounded border border-rig-700/20 bg-white px-4 py-2.5 text-sm font-medium text-rig-900 hover:bg-paper-100"
      >
        No thanks, keep my time
      </button>
      <button
        type="button"
        disabled={state === "busy"}
        onClick={() => send("optout")}
        className="block w-full text-center text-xs text-rig-700/70 underline"
      >
        Don't text me about earlier spots
      </button>
    </div>
  );
}
