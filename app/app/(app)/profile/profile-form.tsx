"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  first_name: string;
  business_name: string;
  trade: string;
  abn: string;
  phone: string;
  service_area: string;
  city: string;
  google_review_link: string;
  bank_details: string;
} | null;

// Matches the trade-specific question sets defined in lib/trade-questions.ts (§8a).
// Add a trade here only once its question set exists there too.
const TRADES = ["Lawn Mowing", "Home Cleaning", "Mobile Mechanic", "Landscaping", "Pool Cleaning"];

export default function ProfileForm({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: Profile;
}) {
  const [firstName, setFirstName] = useState(initialProfile?.first_name ?? "");
  const [businessName, setBusinessName] = useState(initialProfile?.business_name ?? "");
  const [trade, setTrade] = useState(initialProfile?.trade ?? "");
  const [abn, setAbn] = useState(initialProfile?.abn ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [serviceArea, setServiceArea] = useState(initialProfile?.service_area ?? "");
  const [city, setCity] = useState(initialProfile?.city ?? "");
  const [googleReviewLink, setGoogleReviewLink] = useState(initialProfile?.google_review_link ?? "");
  const [bankDetails, setBankDetails] = useState(initialProfile?.bank_details ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
      abn,
      phone,
      service_area: serviceArea,
      city,
      google_review_link: googleReviewLink || null,
      bank_details: bankDetails || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // Best-effort — the profile save above already succeeded regardless of
    // whether this works, so a failure here is silent (§wrong-city-geocode).
    fetch("/api/profile/geocode-city", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city }),
    }).catch(() => {});

    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="first_name" className="field-label">
          Your first name
        </label>
        <input
          id="first_name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="field-input"
          placeholder="e.g. John"
        />
        <p className="mt-1 text-xs text-rig-700/60">
          Used in customer SMS, e.g. "John from Doyle Electrical is on his way."
        </p>
      </div>

      <div>
        <label htmlFor="business_name" className="field-label">
          Business name
        </label>
        <input
          id="business_name"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="field-input"
          placeholder="e.g. Doyle Electrical"
        />
      </div>

      <div>
        <label htmlFor="trade" className="field-label">
          Trade
        </label>
        <select
          id="trade"
          required
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className="field-input"
        >
          <option value="" disabled>
            Select your trade
          </option>
          {TRADES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="abn" className="field-label">
            ABN
          </label>
          <input
            id="abn"
            value={abn}
            onChange={(e) => setAbn(e.target.value)}
            className="field-input"
            placeholder="11 digits"
          />
        </div>
        <div>
          <label htmlFor="phone" className="field-label">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field-input"
            placeholder="04xx xxx xxx"
          />
        </div>
      </div>

      <div>
        <label htmlFor="service_area" className="field-label">
          Service area
        </label>
        <input
          id="service_area"
          value={serviceArea}
          onChange={(e) => setServiceArea(e.target.value)}
          className="field-input"
          placeholder="e.g. Pialba, Urangan, Torquay, Scarness"
        />
        <p className="mt-1 text-xs text-rig-700/60">
          List the actual suburbs you cover, separated by commas — not just a general area name. Sarah uses
          this to recognise local suburb names correctly when callers give their address.
        </p>
      </div>

      <div>
        <label htmlFor="city" className="field-label">
          City
        </label>
        <input
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="field-input"
          placeholder="e.g. Hervey Bay"
        />
        <p className="mt-1 text-xs text-rig-700/60">
          Used to show local weather on your dashboard.
        </p>
      </div>

      <div>
        <label htmlFor="google_review_link" className="field-label">
          Google review link (optional)
        </label>
        <input
          id="google_review_link"
          type="url"
          value={googleReviewLink}
          onChange={(e) => setGoogleReviewLink(e.target.value)}
          className="field-input"
          placeholder="https://g.page/r/..."
        />
        <p className="mt-1 text-xs text-rig-700/60">
          Find this in your Google Business Profile under "Get more reviews." When set, it's added to the
          completion message sent after a job is finished.
        </p>
      </div>

      <div>
        <label htmlFor="bank_details" className="field-label">
          Bank details for payment (optional)
        </label>
        <textarea
          id="bank_details"
          value={bankDetails}
          onChange={(e) => setBankDetails(e.target.value)}
          className="field-input min-h-[60px]"
          placeholder={"BSB: 123-456\nAccount: 12345678\nName: Steve's Mowing"}
        />
        <p className="mt-1 text-xs text-rig-700/60">
          Shown to the customer on the completion message so they can pay by bank transfer — plain text,
          shown exactly as typed.
        </p>
      </div>

      {status === "error" && (
        <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
      )}
      {status === "saved" && (
        <p className="rounded bg-moss-500/10 px-3 py-2 text-sm text-moss-500">
          Saved.
        </p>
      )}

      <button type="submit" disabled={status === "saving"} className="btn-primary w-full">
        {status === "saving" ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
