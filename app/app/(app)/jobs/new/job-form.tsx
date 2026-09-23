"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRADE_QUESTIONS, SOURCE_OPTIONS } from "@/lib/trade-questions";
import { computeEstimate, type TradePricingConfig } from "@/lib/trade-pricing";
import TradeQuestionField from "./trade-question-field";
import ClientSearch, { type ClientOption } from "./client-search";

const DURATION_PRESETS = [30, 60, 90, 120, 180];
const SCHEDULE_BLOCKS = ["Morning", "Afternoon", "Evening"] as const;

type InitialClient = {
  id: string;
  name: string;
  phone: string | null;
  address_street: string | null;
  address_suburb: string | null;
  address_postcode: string | null;
} | null;

export default function JobForm({
  businessId,
  trade,
  pricingConfig,
  initialClient = null,
}: {
  businessId: string;
  trade: string;
  pricingConfig: TradePricingConfig | null;
  initialClient?: InitialClient;
}) {
  const questions = TRADE_QUESTIONS[trade] ?? [];

  // §19 — client link. "search" shows the autocomplete; "picked" shows the
  // (auto-filled or blank) customer fields below, either tied to an
  // existing client (clientId set) or about to create a new one (null).
  // §book-from-client — arriving with a client already known (from their own
  // profile page's "+ New Job" button) starts straight in "picked" mode,
  // pre-filled, skipping the search step entirely.
  const [clientMode, setClientMode] = useState<"search" | "picked">(initialClient ? "picked" : "search");
  const [clientId, setClientId] = useState<string | null>(initialClient?.id ?? null);

  // Core §10 fields
  const [source, setSource] = useState("");
  const [jobLabel, setJobLabel] = useState("");
  const [customerName, setCustomerName] = useState(initialClient?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialClient?.phone ?? "");
  const [street, setStreet] = useState(initialClient?.address_street ?? "");
  const [suburb, setSuburb] = useState(initialClient?.address_suburb ?? "");
  const [postcode, setPostcode] = useState(initialClient?.address_postcode ?? "");
  const [tradeAnswers, setTradeAnswers] = useState<Record<string, any>>({});
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [quoteRequired, setQuoteRequired] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState("");

  // §schedule-on-capture — when a tradie already knows the date (booking a
  // repeat customer on the spot, taking a call where they agreed a time),
  // there's no reason to force a second trip through the Run Sheet's
  // Schedule modal just to enter what they already know. A checkbox toggle
  // here was tried first and turned out too easy to miss (a real test: the
  // field never even showed up because the box wasn't ticked); a blank-date
  // field after that was itself confusing ("what does leaving it blank even
  // mean?"). Now it's an explicit one-click choice — "Schedule it" or
  // "Quote" — with a real label the tradie recognises, matching statusLabel
  // in lib/run-sheet.ts (the underlying status value stays "Unscheduled").
  const [bookingChoice, setBookingChoice] = useState<"" | "schedule" | "quote">("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSlotType, setScheduleSlotType] = useState<"time" | "block">("time");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleBlock, setScheduleBlock] = useState<string>("Morning");
  const wantsSchedule = bookingChoice === "schedule";
  const [recurringFrequency, setRecurringFrequency] = useState<"" | "Weekly" | "Fortnightly" | "Monthly">("");

  function chooseSchedule() {
    setBookingChoice("schedule");
    if (!scheduleDate) setScheduleDate(new Date().toISOString().slice(0, 10));
  }

  function chooseQuote() {
    setBookingChoice("quote");
  }

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // §31 — once pricing is configured for this trade, the estimate
  // recalculates from the trade answers instead of being typed in by hand.
  // Fields stay editable below so the tradie can still override a specific
  // job when the auto-calculated number is wrong.
  useEffect(() => {
    if (!pricingConfig) return;
    const result = computeEstimate(tradeAnswers, pricingConfig);
    if (result.quoteRequired) {
      setQuoteRequired(true);
    } else {
      setQuoteRequired(false);
      setDurationMinutes(result.durationMinutes);
      setEstimatedPrice(result.price.toFixed(2));
    }
  }, [tradeAnswers, pricingConfig]);

  function handleClientSelect(client: ClientOption) {
    setClientId(client.id);
    setCustomerName(client.name);
    setCustomerPhone(client.phone ?? "");
    setStreet(client.address_street ?? "");
    setSuburb(client.address_suburb ?? "");
    setPostcode(client.address_postcode ?? "");
    setClientMode("picked");
  }

  function handleNewClient(typedName: string) {
    // Whatever they'd already typed into the client search box was them
    // typing this customer's name — carry it over instead of discarding it.
    setClientId(null);
    setCustomerName(typedName);
    setCustomerPhone("");
    setStreet("");
    setSuburb("");
    setPostcode("");
    setClientMode("picked");
  }

  function handleTradeAnswerChange(id: string, value: any) {
    setTradeAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setStatus("saving");
    setErrorMessage("");

    const supabase = createClient();

    // 1. §19 — if this customer isn't an existing client, create the client
    // record first so the job can link to it from the moment it's saved.
    let linkedClientId = clientId;
    if (!linkedClientId) {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          business_id: businessId,
          name: customerName,
          phone: customerPhone || null,
          address_street: street || null,
          address_suburb: suburb || null,
          address_postcode: postcode || null,
        })
        .select()
        .single();

      if (clientError || !newClient) {
        setStatus("error");
        setErrorMessage(clientError?.message ?? "Couldn't save the client. Try again.");
        return;
      }
      linkedClientId = newClient.id;
    }

    // 1b. If scheduling now, work out run_order the same way the Run Sheet's
    // own Schedule modal does — appended to the end of that day's jobs.
    let runOrder: number | null = null;
    if (wantsSchedule) {
      const { data: sameDayJobs } = await supabase
        .from("jobs")
        .select("run_order")
        .eq("business_id", businessId)
        .eq("scheduled_date", scheduleDate);
      const maxOrder = (sameDayJobs ?? []).reduce((max, j) => Math.max(max, j.run_order ?? 0), 0);
      runOrder = maxOrder + 10;
    }

    // 2. Create the job row so we have an id to file the photo under.
    const { data: job, error: insertError } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        client_id: linkedClientId,
        source,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        address_street: street || null,
        address_suburb: suburb || null,
        address_postcode: postcode || null,
        job_label: jobLabel.trim() || null,
        trade_answers: tradeAnswers,
        estimated_duration_minutes: durationMinutes === "" ? null : durationMinutes,
        estimated_price: quoteRequired || estimatedPrice === "" ? null : Number(estimatedPrice),
        quote_required: quoteRequired,
        // A tradie entering a job in person already knows the details are
        // right — no real signal in making them pick a confidence level, so
        // manual capture is always High (only the AI-driven phone/widget
        // capture paths actually vary this based on how complete a rushed
        // call turned out to be).
        confidence: "High",
        ...(wantsSchedule
          ? {
              status: "Scheduled",
              scheduled_date: scheduleDate,
              scheduled_time: scheduleSlotType === "time" ? scheduleTime : null,
              scheduled_block: scheduleSlotType === "block" ? scheduleBlock : null,
              run_order: runOrder,
            }
          : {}),
      })
      .select()
      .single();

    if (insertError || !job) {
      setStatus("error");
      setErrorMessage(insertError?.message ?? "Couldn't save the job. Try again.");
      return;
    }

    // 2b. Regular service — generate the next few visits the same way Emma
    // does when she books a recurring job on a call (lib/recurring-jobs.ts).
    // Only meaningful once there's a real first date to build the series
    // from, hence gated on wantsSchedule too, not just the frequency picker.
    if (wantsSchedule && recurringFrequency) {
      const seriesResponse = await fetch(`/api/jobs/${job.id}/create-recurring-series`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency: recurringFrequency,
          date: scheduleDate,
          time: scheduleSlotType === "time" ? scheduleTime : null,
          block: scheduleSlotType === "block" ? scheduleBlock : null,
        }),
      });
      const seriesData = await seriesResponse.json();
      if (!seriesData.ok) {
        setStatus("error");
        setErrorMessage(`Job saved, but the repeat series failed: ${seriesData.error ?? "unknown error"}`);
        return;
      }
    }

    // 2c. Same booking-confirmed text the Run Sheet's own Schedule modal
    // sends on first scheduling (run-sheet-board.tsx) — creating a job
    // Scheduled from the start here shouldn't skip that just because it
    // took a different path to get there. A missing phone number is a
    // normal, silent no-op (§13's own /api/notify already treats it that
    // way) — nothing else here should block the job that already saved.
    if (wantsSchedule && customerPhone) {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, event: "booking_confirmed" }),
      }).catch(() => {});
    }

    // 3. If an arrival photo was attached, upload it and tag the job with
    // its storage path + the timestamp it was captured (§10a).
    if (photoFile) {
      const takenAt = new Date();
      const extension = photoFile.name.split(".").pop() || "jpg";
      const path = `${businessId}/${job.id}/arrival-${takenAt.getTime()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("job-photos")
        .upload(path, photoFile);

      if (uploadError) {
        setStatus("error");
        setErrorMessage(`Job saved, but the photo failed to upload: ${uploadError.message}`);
        return;
      }

      await supabase
        .from("jobs")
        .update({ arrival_photo_path: path, arrival_photo_taken_at: takenAt.toISOString() })
        .eq("id", job.id);
    }

    setStatus("saved");
  }

  function handleCaptureAnother() {
    setClientMode("search");
    setClientId(null);
    setSource("");
    setJobLabel("");
    setCustomerName("");
    setCustomerPhone("");
    setStreet("");
    setSuburb("");
    setPostcode("");
    setTradeAnswers({});
    setDurationMinutes("");
    setQuoteRequired(false);
    setEstimatedPrice("");
    setBookingChoice("");
    setScheduleDate("");
    setScheduleSlotType("time");
    setRecurringFrequency("");
    setScheduleTime("09:00");
    setScheduleBlock("Morning");
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setStatus("idle");
  }

  if (status === "saved") {
    return (
      <div className="text-center">
        <p className="font-display font-semibold text-rig-900">Job captured</p>
        <p className="mt-2 text-sm text-rig-700">
          {customerName}'s job is in as{" "}
          <span className="font-medium">{wantsSchedule ? "Scheduled" : "Quote"}</span>.
        </p>
        <button onClick={handleCaptureAnother} className="btn-primary mt-4 w-full">
          Capture another job
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Source */}
      <div>
        <label className="field-label">Source</label>
        <select
          required
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="field-input"
        >
          <option value="" disabled>
            How did this job come in?
          </option>
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* §32e — short free-text label, since trade-specific Q&A answers
          don't reduce to a clean short label across every trade. */}
      <div>
        <label className="field-label">Job label (optional)</label>
        <input
          value={jobLabel}
          onChange={(e) => setJobLabel(e.target.value)}
          maxLength={80}
          className="field-input"
          placeholder="e.g. Front & back, Hedge trim & tidy up"
        />
      </div>

      {/* Customer / client (§19) */}
      <div className="border-t border-rig-900/10 pt-4">
        {clientMode === "search" ? (
          <ClientSearch businessId={businessId} onSelect={handleClientSelect} onNew={handleNewClient} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="field-label mb-0">{clientId ? "Client" : "New client"}</p>
              <button
                type="button"
                onClick={() => setClientMode("search")}
                className="text-sm font-medium text-steel-500 hover:underline"
              >
                Change
              </button>
            </div>
            <div>
              <label className="field-label">Customer name</label>
              <input
                required
                autoComplete="off"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Contact number</label>
              <input
                type="tel"
                autoComplete="off"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="field-input"
                placeholder="04xx xxx xxx"
              />
            </div>
            <div>
              <label className="field-label">Street address</label>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="field-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Suburb</label>
                <input
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Postcode</label>
                <input
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>
            {clientId && (
              <Link
                href={`/app/clients/${clientId}`}
                className="inline-block text-sm font-medium text-steel-500 hover:underline"
              >
                View client profile →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Trade-specific questions */}
      {questions.length > 0 ? (
        <div className="space-y-4 border-t border-rig-900/10 pt-4">
          <p className="font-mono text-xs uppercase tracking-widest text-steel-500">
            {trade} details
          </p>
          {questions.map((q) => (
            <TradeQuestionField
              key={q.id}
              question={q}
              value={tradeAnswers[q.id]}
              onChange={handleTradeAnswerChange}
            />
          ))}
        </div>
      ) : (
        <p className="border-t border-rig-900/10 pt-4 text-sm text-rig-700">
          No question set is configured yet for "{trade}". Core job details will still be saved.
        </p>
      )}

      {/* Estimate */}
      <div className="space-y-4 border-t border-rig-900/10 pt-4">
        {pricingConfig && (
          <p className="text-xs text-rig-700/60">
            Calculated from the job details above, using your {trade} pricing setup. Adjust
            below if this specific job is different.
          </p>
        )}
        <div>
          <label className="field-label">Estimated duration</label>
          {!pricingConfig && (
            <div className="mb-2 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setDurationMinutes(mins)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    durationMinutes === mins
                      ? "border-amber-600 bg-amber-500 text-rig-950"
                      : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          )}
          <input
            type="number"
            min={0}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value === "" ? "" : Number(e.target.value))}
            className="field-input"
            placeholder="Custom — minutes"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="field-label mb-0">Estimated price</label>
            <label className="flex items-center gap-2 text-sm text-rig-700">
              <input
                type="checkbox"
                checked={quoteRequired}
                onChange={(e) => setQuoteRequired(e.target.checked)}
                className="h-4 w-4 rounded border-rig-700/30"
              />
              Quote required
            </label>
          </div>
          <input
            type="number"
            min={0}
            step="0.01"
            disabled={quoteRequired}
            value={estimatedPrice}
            onChange={(e) => setEstimatedPrice(e.target.value)}
            className="field-input mt-1 disabled:bg-paper-100 disabled:text-rig-700/50"
            placeholder={quoteRequired ? "Quote required — price not set" : "e.g. 250.00"}
          />
        </div>
      </div>

      {/* Arrival photo */}
      <div className="border-t border-rig-900/10 pt-4">
        <label className="field-label">Arrival photo (optional)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          className="block w-full text-sm text-rig-700 file:mr-3 file:rounded file:border-0 file:bg-rig-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-paper-50 hover:file:bg-rig-800"
        />
        {photoPreviewUrl && (
          <img
            src={photoPreviewUrl}
            alt="Arrival photo preview"
            className="mt-3 h-40 w-full rounded object-cover"
          />
        )}
        <p className="mt-1 text-xs text-rig-700/70">
          Timestamped automatically and filed under your business when saved.
        </p>
      </div>

      <div className="border-t border-rig-900/10 pt-4">
        <label className="field-label">When's this job?</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={chooseSchedule}
            className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${
              bookingChoice === "schedule"
                ? "border-amber-600 bg-amber-500 text-rig-950"
                : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
            }`}
          >
            Schedule it
          </button>
          <button
            type="button"
            onClick={chooseQuote}
            className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${
              bookingChoice === "quote"
                ? "border-amber-600 bg-amber-500 text-rig-950"
                : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
            }`}
          >
            Quote
          </button>
        </div>
        <p className="mt-1 text-xs text-rig-700/60">
          {bookingChoice === "schedule" ? (
            "Will save as Scheduled for the date below."
          ) : bookingChoice === "quote" ? (
            <>
              Saves as a <span className="font-medium text-rig-900">Quote</span> — it'll sit in the Quotes
              tray on your Run Sheet until you follow up and give it a date.
            </>
          ) : (
            "Pick one — you don't have a date yet? Choose Quote and follow it up later."
          )}
        </p>

        {wantsSchedule && (
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="field-input mt-3"
          />
        )}

        {wantsSchedule && (
          <div className="mt-3 space-y-3 rounded border border-rig-700/20 bg-paper-100 p-3">
            <div>
              <label className="field-label">Time slot</label>
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleSlotType("time")}
                  className={`flex-1 rounded border px-3 py-1.5 text-sm ${
                    scheduleSlotType === "time"
                      ? "border-amber-600 bg-amber-500 text-rig-950"
                      : "border-rig-700/20 bg-white text-rig-700"
                  }`}
                >
                  Specific time
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleSlotType("block")}
                  className={`flex-1 rounded border px-3 py-1.5 text-sm ${
                    scheduleSlotType === "block"
                      ? "border-amber-600 bg-amber-500 text-rig-950"
                      : "border-rig-700/20 bg-white text-rig-700"
                  }`}
                >
                  Time-of-day block
                </button>
              </div>
              {scheduleSlotType === "time" ? (
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="field-input"
                />
              ) : (
                <div className="flex gap-2">
                  {SCHEDULE_BLOCKS.map((b) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setScheduleBlock(b)}
                      className={`flex-1 rounded border px-3 py-2 text-sm ${
                        scheduleBlock === b
                          ? "border-amber-600 bg-amber-500 text-rig-950"
                          : "border-rig-700/20 bg-white text-rig-700"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="field-label">Repeat customer? (optional)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRecurringFrequency("")}
                  className={`rounded border px-3 py-1.5 text-sm ${
                    recurringFrequency === ""
                      ? "border-amber-600 bg-amber-500 text-rig-950"
                      : "border-rig-700/20 bg-white text-rig-700"
                  }`}
                >
                  One-off
                </button>
                {(["Weekly", "Fortnightly", "Monthly"] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setRecurringFrequency(freq)}
                    className={`rounded border px-3 py-1.5 text-sm ${
                      recurringFrequency === freq
                        ? "border-amber-600 bg-amber-500 text-rig-950"
                        : "border-rig-700/20 bg-white text-rig-700"
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
              {recurringFrequency && (
                <p className="mt-1 text-xs text-rig-700/60">
                  Books the next 5 {recurringFrequency.toLowerCase()} visits too, skipping any that clash with
                  something already on your schedule.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {status === "error" && (
        <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
      )}

      <button type="submit" disabled={status === "saving"} className="btn-primary w-full">
        {status === "saving" ? "Saving…" : "Capture job"}
      </button>
    </form>
  );
}
