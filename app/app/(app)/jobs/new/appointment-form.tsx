"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TRADE_QUESTIONS, staffPreference } from "@/lib/trade-questions";
import { computeEstimate, type TradePricingConfig } from "@/lib/trade-pricing";
import TradeQuestionField from "./trade-question-field";
import ClientSearch, { type ClientOption } from "./client-search";

const DURATION_PRESETS = [30, 60, 90, 120];

type InitialClient = { id: string; name: string; phone: string | null } | null;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Next 5-minute mark, so a walk-in lands on a tidy time rather than 2:13.
function nowRoundedUp() {
  const d = new Date();
  const mins = Math.ceil((d.getHours() * 60 + d.getMinutes()) / 5) * 5;
  return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
}

function friendlyTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ""}${h < 12 ? "am" : "pm"}`;
}

function friendlyDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

// The salon / massage front-desk form: add a walk-in, a phone booking, or a
// regular booking again after their cut, in one short page. Deliberately not
// the tradie job form (no address, photos, quotes or route), and it saves
// through /api/appointments so the same chair-aware availability rules apply
// as for Sarah and the public booking page.
export default function AppointmentForm({
  businessId,
  trade,
  pricingConfig,
  staffNames,
  initialClient = null,
  initialAnswers = {},
  initialDate,
  initialTime,
}: {
  businessId: string;
  trade: string;
  pricingConfig: TradePricingConfig | null;
  staffNames: string[];
  initialClient?: InitialClient;
  initialAnswers?: Record<string, any>;
  // Set when arriving from a tapped slot on the Appointments day view.
  initialDate?: string;
  initialTime?: string;
}) {
  const questions = TRADE_QUESTIONS[trade] ?? [];
  const pref = staffPreference(trade);

  const [clientMode, setClientMode] = useState<"search" | "picked">(initialClient ? "picked" : "search");
  const [clientId, setClientId] = useState<string | null>(initialClient?.id ?? null);
  const [name, setName] = useState(initialClient?.name ?? "");
  const [phone, setPhone] = useState(initialClient?.phone ?? "");

  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [duration, setDuration] = useState<number | "">("");
  const [price, setPrice] = useState<number | null>(null);

  const [date, setDate] = useState(initialDate ?? localDate(new Date()));
  const [time, setTime] = useState(initialTime ?? "09:00");

  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [savedLabel, setSavedLabel] = useState("");

  // Same estimate the tradie form uses: length and price come from the
  // owner's Pricing page, so the diary shows real appointment lengths.
  useEffect(() => {
    if (!pricingConfig) return;
    const result = computeEstimate(answers, pricingConfig);
    if (!result.quoteRequired) {
      setDuration(result.durationMinutes);
      setPrice(result.price);
    }
  }, [answers, pricingConfig]);

  function pickClient(c: ClientOption) {
    setClientId(c.id);
    setName(c.name);
    setPhone(c.phone ?? "");
    setClientMode("picked");
  }

  function newClient(typed: string) {
    setClientId(null);
    setName(typed);
    setPhone("");
    setClientMode("picked");
  }

  function setAnswer(id: string, value: any) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function book(force = false) {
    if (!name.trim()) {
      setError("Please enter the client's name.");
      return;
    }
    setStatus("saving");
    setError("");
    setSuggestions(null);

    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        name,
        phone,
        tradeAnswers: answers,
        durationMinutes: duration === "" ? null : duration,
        price,
        date,
        time,
        force,
      }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);

    if (data?.clientId) setClientId(data.clientId);

    if (data?.ok) {
      // Confirmation text only when it's not for the next hour or so; a
      // walk-in standing at the desk doesn't need one.
      const startsSoon = date === localDate(new Date()) && Math.abs(new Date(`${date}T${time}:00`).getTime() - Date.now()) < 90 * 60 * 1000;
      if (phone.trim() && !startsSoon) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: data.jobId, event: "booking_confirmed" }),
        }).catch(() => {});
      }
      setSavedLabel(`${friendlyDay(date)} at ${friendlyTime(time)}`);
      setStatus("saved");
      return;
    }

    setStatus("idle");
    if (data?.conflict) {
      setSuggestions(data.suggestions ?? []);
      return;
    }
    setError(data?.error ?? "Something went wrong. Please try again.");
  }

  function reset() {
    setClientMode("search");
    setClientId(null);
    setName("");
    setPhone("");
    setAnswers({});
    setDuration("");
    setPrice(null);
    setDate(localDate(new Date()));
    setTime("09:00");
    setSuggestions(null);
    setError("");
    setStatus("idle");
  }

  if (status === "saved") {
    return (
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-rig-900">Booked</p>
        <p className="mt-2 text-sm text-rig-700">
          {name} · {savedLabel}
        </p>
        <button onClick={reset} className="btn-primary mt-4 w-full">
          Book another
        </button>
        <Link
          href={`/app/appointments?date=${date}`}
          className="mt-3 inline-block text-sm font-medium text-steel-500 hover:underline"
        >
          Back to appointments
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        book();
      }}
      className="space-y-6"
    >
      {/* Who */}
      <div>
        {clientMode === "search" ? (
          <ClientSearch businessId={businessId} onSelect={pickClient} onNew={newClient} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="field-label mb-0">{clientId ? "Client" : "New client"}</p>
              <button type="button" onClick={() => setClientMode("search")} className="text-sm font-medium text-steel-500 hover:underline">
                Change
              </button>
            </div>
            <input
              required
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              placeholder="Name"
            />
            <input
              type="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field-input"
              placeholder="Mobile (for a reminder text)"
            />
          </div>
        )}
      </div>

      {/* What */}
      <div className="space-y-4 border-t border-rig-900/10 pt-4">
        {questions.map((q) =>
          pref && q.id === pref.questionId && staffNames.length > 0 ? (
            <div key={q.id}>
              <label className="field-label">With {pref.role === "stylist" ? "which stylist" : "which therapist"}?</label>
              <div className="flex flex-wrap gap-2">
                {["No preference", ...staffNames].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setAnswer(q.id, n)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      (answers[q.id] ?? "No preference") === n
                        ? "border-amber-600 bg-amber-500 text-rig-950"
                        : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <TradeQuestionField key={q.id} question={q} value={answers[q.id]} onChange={setAnswer} />
          )
        )}

        {pricingConfig ? (
          duration !== "" && (
            <p className="text-sm text-rig-700">
              About {duration} min{price != null ? ` · $${price.toFixed(2)}` : ""}
            </p>
          )
        ) : (
          <div>
            <label className="field-label">How long?</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setDuration(mins)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    duration === mins
                      ? "border-amber-600 bg-amber-500 text-rig-950"
                      : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* When */}
      <div className="border-t border-rig-900/10 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="field-label mb-0">When?</label>
          <button
            type="button"
            onClick={() => {
              setDate(localDate(new Date()));
              setTime(nowRoundedUp());
              setSuggestions(null);
            }}
            className="rounded-full border border-rig-700/20 bg-white px-3 py-1 text-sm font-medium text-rig-900 hover:bg-paper-100"
          >
            Walk-in, now
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" required value={date} onChange={(e) => { setDate(e.target.value); setSuggestions(null); }} className="field-input" />
          <input type="time" required value={time} onChange={(e) => { setTime(e.target.value); setSuggestions(null); }} className="field-input" />
        </div>
      </div>

      {suggestions && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-rig-900">
          <p className="font-medium">
            {friendlyTime(time)} is fully booked.
          </p>
          {suggestions.length > 0 ? (
            <>
              <p className="mt-1 text-rig-700">Nearest free times:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => {
                      setTime(t);
                      setSuggestions(null);
                    }}
                    className="rounded-full border border-rig-700/20 bg-white px-3 py-1.5 font-medium hover:bg-paper-100"
                  >
                    {friendlyTime(t)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-1 text-rig-700">Nothing else is free that day.</p>
          )}
          <button type="button" onClick={() => book(true)} className="mt-3 text-sm font-medium text-steel-500 hover:underline">
            Squeeze them in anyway
          </button>
        </div>
      )}

      {error && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}

      <button type="submit" disabled={status === "saving"} className="btn-primary w-full">
        {status === "saving" ? "Booking…" : "Book appointment"}
      </button>
    </form>
  );
}
