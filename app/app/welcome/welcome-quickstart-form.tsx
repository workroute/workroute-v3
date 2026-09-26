"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRADE_NAMES } from "@/lib/trade-questions";

// §staged-onboarding — the only 3 fields actually required to have a
// working profile (same fields profile-form.tsx marks `required`), plus
// one optional starting price so Sarah has something to say on a call
// before the full per-question pricing matrix exists (see
// lib/phone-ai.ts's three-way pricing branch). Everything else — work
// hours, voice, detailed pricing — stays in Settings, not asked here.
export default function WelcomeQuickstartForm({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [trade, setTrade] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.from("business_profiles").upsert({
      user_id: userId,
      first_name: firstName,
      business_name: businessName,
      trade,
      starting_price: startingPrice.trim() === "" ? null : Number(startingPrice),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 w-full max-w-sm space-y-4 text-left">
      <p className="text-sm text-paper-50/70">
        Just three things to get Sarah working — everything else (pricing details, work hours, her voice) you can
        fill in later, whenever you've got a spare ten minutes.
      </p>

      <div>
        <label htmlFor="qs_first_name" className="field-label !text-paper-50/80">
          Your first name
        </label>
        <input
          id="qs_first_name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="field-input"
          placeholder="e.g. John"
        />
      </div>

      <div>
        <label htmlFor="qs_business_name" className="field-label !text-paper-50/80">
          Business name
        </label>
        <input
          id="qs_business_name"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="field-input"
          placeholder="e.g. Doyle Electrical"
        />
      </div>

      <div>
        <label htmlFor="qs_trade" className="field-label !text-paper-50/80">
          Trade
        </label>
        <select
          id="qs_trade"
          required
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className="field-input"
        >
          <option value="" disabled>
            Choose your trade
          </option>
          {TRADE_NAMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="qs_starting_price" className="field-label !text-paper-50/80">
          Starting price (optional)
        </label>
        <input
          id="qs_starting_price"
          type="number"
          min={0}
          step="0.01"
          value={startingPrice}
          onChange={(e) => setStartingPrice(e.target.value)}
          className="field-input"
          placeholder="e.g. 60"
        />
        <p className="mt-1 text-xs text-paper-50/50">
          So Sarah can say "prices start at $X" before you've set up detailed pricing. Add it now or skip it.
        </p>
      </div>

      {status === "error" && (
        <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
      )}

      <button type="submit" disabled={status === "saving"} className="btn-primary w-full">
        {status === "saving" ? "Saving…" : "Get Sarah ready"}
      </button>
    </form>
  );
}
