"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateMissedCallCost,
  DEFAULT_INPUTS,
  formatCount,
  formatDollars,
  LIMITS,
  WORKROUTE_DEMO_PHONE,
  WORKROUTE_MONTHLY_PRICE,
  WORKROUTE_SIGNUP_URL,
  type MissedCallInputs,
} from "@/lib/missed-call-cost";

// Rough starting points for the trades on the outreach list — every number
// stays editable, these just save a tradie typing on their phone.
const TRADE_PRESETS: { label: string; jobValue: number; jobsPerYear: number }[] = [
  { label: "Mowing", jobValue: 60, jobsPerYear: 20 },
  { label: "Cleaning", jobValue: 150, jobsPerYear: 12 },
  { label: "Pool", jobValue: 120, jobsPerYear: 12 },
  { label: "Handyman", jobValue: 250, jobsPerYear: 2 },
  { label: "Plumber", jobValue: 400, jobsPerYear: 1 },
  { label: "Electrician", jobValue: 450, jobsPerYear: 1 },
  { label: "Hairdresser", jobValue: 95, jobsPerYear: 8 },
  { label: "Massage", jobValue: 100, jobsPerYear: 8 },
];

const SLIDERS: { key: keyof MissedCallInputs; label: string; hint: string }[] = [
  { key: "missedPct", label: "Calls you miss", hint: "Rang out, went to voicemail, or you couldn't pick up on the job." },
  { key: "newWorkPct", label: "Missed calls that are new work", hint: "Not spam, suppliers or customers you already have." },
  { key: "noCallbackPct", label: "New callers who ring someone else", hint: "Instead of leaving a message or trying you again." },
  { key: "winPct", label: "Enquiries you usually win", hint: "When you do get to talk to them." },
];

type ReportState = "idle" | "sending" | "sent";

export default function Calculator() {
  const [inputs, setInputs] = useState<MissedCallInputs>(DEFAULT_INPUTS);
  const [trade, setTrade] = useState<string | null>(null);
  const result = useMemo(() => calculateMissedCallCost(inputs), [inputs]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [report, setReport] = useState<ReportState>("idle");
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof MissedCallInputs, raw: string) {
    const { min, max } = LIMITS[key];
    const value = raw === "" ? min : Math.min(max, Math.max(min, Number(raw)));
    if (Number.isFinite(value)) setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function pickTrade(preset: (typeof TRADE_PRESETS)[number]) {
    setTrade(preset.label);
    setInputs((prev) => ({ ...prev, jobValue: preset.jobValue, jobsPerYear: preset.jobsPerYear }));
  }

  async function sendReport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport("sending");
    try {
      const res = await fetch("/api/missed-call-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, business, website, inputs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setReport("idle");
        return;
      }
      setReport("sent");
    } catch {
      setError("Couldn't connect. Check your signal and try again.");
      setReport("idle");
    }
  }

  const demoTel = `tel:${WORKROUTE_DEMO_PHONE.replace(/\s/g, "")}`;

  return (
    <div className="mx-auto -mt-6 grid max-w-3xl gap-6 px-4 pb-10 md:grid-cols-[1fr_minmax(0,300px)] md:items-start">
      {/* Inputs */}
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-rig-900">Your numbers</h2>

        <p className="field-label mt-4">Your business (optional)</p>
        <div className="flex flex-wrap gap-2">
          {TRADE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => pickTrade(preset)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                trade === preset.label
                  ? "border-amber-500 bg-amber-500/15 font-medium text-rig-900"
                  : "border-rig-700/20 text-rig-700 hover:bg-paper-100"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Calls a week"
            value={inputs.callsPerWeek}
            onChange={(v) => set("callsPerWeek", v)}
            field="callsPerWeek"
          />
          <NumberField
            label="Average job ($)"
            value={inputs.jobValue}
            onChange={(v) => {
              setTrade(null);
              set("jobValue", v);
            }}
            field="jobValue"
          />
          <NumberField
            label="Jobs per customer a year"
            value={inputs.jobsPerYear}
            onChange={(v) => {
              setTrade(null);
              set("jobsPerYear", v);
            }}
            field="jobsPerYear"
          />
        </div>

        <div className="mt-6 space-y-5">
          {SLIDERS.map(({ key, label, hint }) => (
            <div key={key}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={key} className="font-display text-sm font-medium text-rig-800">
                  {label}
                </label>
                <span className="font-mono text-sm font-medium text-rig-900">{inputs[key]}%</span>
              </div>
              <input
                id={key}
                type="range"
                min={LIMITS[key].min}
                max={LIMITS[key].max}
                step={LIMITS[key].step}
                value={inputs[key]}
                onChange={(e) => set(key, e.target.value)}
                className="mt-2 w-full accent-amber-500"
              />
              <p className="mt-1 text-xs text-rig-700/70">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Result */}
      <aside id="result" className="scroll-mt-6 rounded-lg bg-rig-900 p-5 text-paper-50 shadow-lg md:sticky md:top-6" aria-live="polite">
        <p className="font-mono text-xs uppercase tracking-widest text-amber-500">Work going elsewhere</p>
        <p className="mt-2 font-display text-4xl font-bold text-amber-500">{formatDollars(result.lostPerYear)}</p>
        <p className="text-sm text-paper-50/70">a year, about {formatDollars(result.lostPerMonth)} a month</p>

        <dl className="mt-5 space-y-2 border-t border-paper-50/10 pt-4 text-sm">
          <Stat label="Missed calls a week" value={formatCount(result.missedPerWeek)} />
          <Stat label="New customers lost a week" value={formatCount(result.lostJobsPerWeek)} />
          <Stat label="New customers lost a year" value={formatCount(result.lostCustomersPerYear)} />
          <Stat label="Worth per customer a year" value={formatDollars(result.valuePerCustomer)} />
        </dl>

        <p className="mt-5 border-t border-paper-50/10 pt-4 text-sm text-paper-50/80">
          WorkRoute&apos;s AI receptionist answers the calls you can&apos;t get to and books the job in. It&apos;s $
          {WORKROUTE_MONTHLY_PRICE} a month
          {result.jobsToCoverPrice > 0 && (
            <>
              , so it pays for itself if it saves you{" "}
              <strong className="text-paper-50">
                {result.jobsToCoverPrice} job{result.jobsToCoverPrice === 1 ? "" : "s"} a month
              </strong>
            </>
          )}
          .
        </p>
      </aside>

      {/* Phones: the result card sits below the sliders, so keep the total
          in view while they drag. */}
      <a
        href="#result"
        className="fixed inset-x-0 bottom-0 z-10 flex items-baseline justify-between gap-3 bg-rig-950 px-4 py-3 text-paper-50 shadow-lg md:hidden"
      >
        <span className="text-sm text-paper-50/70">Work going elsewhere</span>
        <span className="font-display text-xl font-bold text-amber-500">{formatDollars(result.lostPerYear)}/yr</span>
      </a>

      {/* Email report */}
      <section className="rounded-lg bg-white p-5 shadow-sm md:col-span-2">
        {report === "sent" ? (
          <div>
            <h2 className="font-display text-lg font-semibold text-rig-900">Report sent. Check your inbox.</h2>
            <p className="mt-1 text-sm text-rig-700">
              It might take a minute, and it&apos;s worth checking your junk folder. Steve, the founder, may also be in
              touch.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={demoTel} className="btn-primary">
                Hear Sarah answer: {WORKROUTE_DEMO_PHONE}
              </a>
              <a href={WORKROUTE_SIGNUP_URL} className="btn-secondary">
                Start a free trial
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={sendReport}>
            <h2 className="font-display text-lg font-semibold text-rig-900">Email me this report</h2>
            <p className="mt-1 text-sm text-rig-700">A copy of your numbers to keep. No spam, no lock-in.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="report-name" className="field-label">
                  First name
                </label>
                <input
                  id="report-name"
                  required
                  autoComplete="given-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="report-email" className="field-label">
                  Email
                </label>
                <input
                  id="report-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="report-business" className="field-label">
                  Business name (optional)
                </label>
                <input
                  id="report-business"
                  autoComplete="organization"
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>
            {/* Honeypot: hidden from people, filled in by bots. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="hidden"
              aria-hidden="true"
            />
            {error && <p className="mt-3 text-sm text-rust-500">{error}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary" disabled={report === "sending"}>
                {report === "sending" ? "Sending…" : "Email my report"}
              </button>
              <a href={demoTel} className="text-sm font-medium text-steel-500 underline">
                Or ring Sarah: {WORKROUTE_DEMO_PHONE}
              </a>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  field,
}: {
  label: string;
  value: number;
  onChange: (raw: string) => void;
  field: keyof MissedCallInputs;
}) {
  // Local text so a tradie can clear the box and retype without it snapping
  // to the minimum mid-typing; only real numbers flow up to the calculation.
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
  }, [value]);

  return (
    <div>
      <label htmlFor={field} className="field-label">
        {label}
      </label>
      <input
        id={field}
        type="number"
        inputMode="numeric"
        min={LIMITS[field].min}
        max={LIMITS[field].max}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value !== "") onChange(e.target.value);
        }}
        onBlur={() => setText(String(value))}
        className="field-input"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-paper-50/70">{label}</dt>
      <dd className="font-mono font-medium">{value}</dd>
    </div>
  );
}
