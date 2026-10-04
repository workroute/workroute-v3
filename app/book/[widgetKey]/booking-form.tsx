"use client";

import { useState } from "react";

type Step = "details" | "date" | "times" | "confirmed";

// fixedLocation: the customer comes to the business (salon, massage), so no
// address is collected and the wording is "appointment", not "job".
export default function BookingForm({ widgetKey, fixedLocation = false }: { widgetKey: string; fixedLocation?: boolean }) {
  // One booking flow per page visit — no need to persist across reloads the
  // way the website chat widget does, so a plain in-memory id is enough.
  const [sessionId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>("details");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressSuburb, setAddressSuburb] = useState("");
  const [addressPostcode, setAddressPostcode] = useState("");
  const [jobLabel, setJobLabel] = useState("");

  const [date, setDate] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [confirmedLabel, setConfirmedLabel] = useState("");

  async function post(action: string, extra: Record<string, unknown>) {
    const response = await fetch(`/api/book/${widgetKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sessionId, ...extra }),
    });
    return response.json();
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !jobLabel.trim() || (!fixedLocation && (!addressStreet.trim() || !addressSuburb.trim()))) {
      setError("Please fill in every field.");
      return;
    }
    setBusy(true);
    setError("");
    const data = await post("start", {
      name,
      phone,
      addressStreet,
      addressSuburb,
      addressPostcode,
      jobLabel,
    });
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "Something went wrong — please try again.");
      return;
    }
    setJobId(data.jobId);
    setStep("date");
  }

  async function handleFindTimes() {
    if (!date) {
      setError("Pick a date first.");
      return;
    }
    setBusy(true);
    setError("");
    const data = await post("check_availability", { jobId, date });
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "Couldn't check availability — please try again.");
      return;
    }
    setTimes(data.times);
    setStep("times");
  }

  async function handlePickTime(time: string) {
    setBusy(true);
    setError("");
    const data = await post("confirm", { jobId, date, time });
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "Couldn't confirm that booking — please try again.");
      if (data.retry) handleFindTimes();
      return;
    }
    setConfirmedLabel(data.appointmentLabel);
    setStep("confirmed");
  }

  if (step === "confirmed") {
    return (
      <div className="rounded-lg border border-moss-500/20 bg-moss-500/10 p-4 text-sm text-moss-500">
        <p className="font-medium">You're booked in for {confirmedLabel}.</p>
        <p className="mt-1 text-rig-700">A text confirming the details is on its way to your phone.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {step === "details" && (
        <form onSubmit={handleDetailsSubmit} className="space-y-3">
          <p className="text-sm text-rig-700">
            {fixedLocation ? "Tell us what you'd like to book and we'll find you a time." : "Tell us a bit about the job and we'll find you a time."}
          </p>
          <div>
            <label className="field-label">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder="e.g. Jane Smith" />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field-input"
              placeholder="04XX XXX XXX"
            />
          </div>
          {!fixedLocation && (
          <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Street address</label>
              <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">Suburb</label>
              <input value={addressSuburb} onChange={(e) => setAddressSuburb(e.target.value)} className="field-input" />
            </div>
          </div>
          <div>
            <label className="field-label">Postcode (optional)</label>
            <input value={addressPostcode} onChange={(e) => setAddressPostcode(e.target.value)} className="field-input" />
          </div>
          </>
          )}
          <div>
            <label className="field-label">{fixedLocation ? "What would you like to book?" : "What do you need done?"}</label>
            <textarea
              value={jobLabel}
              onChange={(e) => setJobLabel(e.target.value)}
              className="field-input min-h-[60px]"
              placeholder={fixedLocation ? "e.g. Cut and colour" : "e.g. Front and back lawn mow"}
            />
          </div>

          {error && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      )}

      {step === "date" && (
        <div className="space-y-3">
          <p className="text-sm text-rig-700">What day suits?</p>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="field-input"
          />
          {error && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}
          <button type="button" onClick={handleFindTimes} disabled={busy || !date} className="btn-primary w-full">
            {busy ? "Checking…" : "Find a time"}
          </button>
        </div>
      )}

      {step === "times" && (
        <div className="space-y-3">
          <button type="button" onClick={() => setStep("date")} className="text-sm font-medium text-steel-500 hover:underline">
            ← Pick a different date
          </button>
          {times.length === 0 ? (
            <p className="text-sm text-rig-700">Nothing free that day — try another date.</p>
          ) : (
            <>
              <p className="text-sm text-rig-700">Pick a time:</p>
              <div className="grid grid-cols-3 gap-2">
                {times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    disabled={busy}
                    onClick={() => handlePickTime(time)}
                    className="rounded border border-rig-700/20 bg-white px-3 py-2 text-sm font-medium text-rig-900 hover:bg-paper-100"
                  >
                    {time}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
