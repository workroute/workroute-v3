"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LapsedClient } from "@/lib/reactivation";

export default function ReactivationForm({
  userId,
  initialLapsedMonths,
  initialLapsedClients,
  hasVapiNumber,
}: {
  userId: string;
  initialLapsedMonths: number;
  initialLapsedClients: LapsedClient[];
  hasVapiNumber: boolean;
}) {
  const [lapsedMonths, setLapsedMonths] = useState(initialLapsedMonths);
  const [thresholdStatus, setThresholdStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [thresholdError, setThresholdError] = useState("");

  const [clients, setClients] = useState(initialLapsedClients);
  // Per-client call state, so one row's in-flight call doesn't disable the
  // others — keyed by client id.
  const [callStatus, setCallStatus] = useState<Record<string, "idle" | "calling" | "called" | "error">>({});
  const [callError, setCallError] = useState<Record<string, string>>({});

  async function handleSaveThreshold(e: React.FormEvent) {
    e.preventDefault();
    setThresholdStatus("saving");
    setThresholdError("");

    const supabase = createClient();
    const { error } = await supabase
      .from("business_profiles")
      .update({ reactivation_lapsed_months: lapsedMonths })
      .eq("user_id", userId);

    if (error) {
      setThresholdStatus("error");
      setThresholdError(error.message);
      return;
    }
    setThresholdStatus("saved");
    // Note: the list above was fetched server-side using the *old*
    // threshold — a saved change here applies from the next page load, not
    // live to the list already on screen. Simple and predictable rather
    // than re-running the lapsed-client query client-side for this.
  }

  async function handleCall(clientId: string) {
    setCallStatus((prev) => ({ ...prev, [clientId]: "calling" }));
    setCallError((prev) => ({ ...prev, [clientId]: "" }));

    const res = await fetch("/api/reactivation/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setCallStatus((prev) => ({ ...prev, [clientId]: "error" }));
      setCallError((prev) => ({ ...prev, [clientId]: data.error ?? "Call failed" }));
      return;
    }

    setCallStatus((prev) => ({ ...prev, [clientId]: "called" }));
  }

  async function handleDoNotCall(clientId: string) {
    const supabase = createClient();
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    await supabase.from("clients").update({ do_not_call: true }).eq("id", clientId);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSaveThreshold} className="space-y-4">
        <div>
          <label className="field-label">Consider a client lapsed after (months)</label>
          <input
            type="number"
            min={1}
            max={36}
            value={lapsedMonths}
            onChange={(e) => {
              setLapsedMonths(Number(e.target.value));
              setThresholdStatus("idle");
            }}
            className="field-input w-24"
          />
        </div>
        {thresholdStatus === "error" && (
          <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{thresholdError}</p>
        )}
        {thresholdStatus === "saved" && <p className="text-sm text-moss-500">Saved.</p>}
        <button type="submit" disabled={thresholdStatus === "saving"} className="btn-primary">
          {thresholdStatus === "saving" ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="border-t border-rig-900/10 pt-6">
        <p className="font-display font-semibold text-rig-900">Lapsed clients · {clients.length}</p>
        <p className="mt-1 text-xs text-rig-700/70">
          No job completed within the threshold above. Calling one places a real phone call right away.
        </p>

        <div className="mt-4 space-y-2">
          {clients.map((client) => {
            const status = callStatus[client.id] ?? "idle";
            return (
              <div key={client.id} className="rounded border border-rig-700/20 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-rig-900">{client.name}</p>
                    <p className="truncate text-rig-700/70">
                      {client.phone} · last job {client.lastJobDate}
                      {client.lastReactivationCallAt && ` · already called ${client.lastReactivationCallAt.slice(0, 10)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCall(client.id)}
                      disabled={!hasVapiNumber || status === "calling" || status === "called"}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      {status === "calling" ? "Calling…" : status === "called" ? "Called" : "Call now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDoNotCall(client.id)}
                      className="text-xs font-medium text-rust-500 hover:underline"
                    >
                      Do not call
                    </button>
                  </div>
                </div>
                {status === "error" && (
                  <p className="mt-1 rounded bg-rust-500/10 px-2 py-1 text-xs text-rust-500">{callError[client.id]}</p>
                )}
              </div>
            );
          })}
          {clients.length === 0 && <p className="text-sm text-rig-700/60">No lapsed clients right now.</p>}
        </div>
      </div>
    </div>
  );
}
