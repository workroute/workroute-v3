"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/clients";
import VoiceInputButton from "./voice-input-button";

export default function ClientDetailForm({ client }: { client: Client }) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [street, setStreet] = useState(client.address_street ?? "");
  const [suburb, setSuburb] = useState(client.address_suburb ?? "");
  const [postcode, setPostcode] = useState(client.address_postcode ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [doNotCall, setDoNotCall] = useState(client.do_not_call);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .update({
        name,
        phone: phone || null,
        email: email || null,
        address_street: street || null,
        address_suburb: suburb || null,
        address_postcode: postcode || null,
        notes: notes || null,
        do_not_call: doNotCall,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="field-label">Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="field-input" />
      </div>
      <div>
        <label className="field-label">Contact number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="field-input"
          placeholder="04xx xxx xxx"
        />
      </div>
      <div>
        <label className="field-label">Email (optional)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
          placeholder="customer@example.com"
        />
      </div>
      <div>
        <label className="field-label">Street address</label>
        <input value={street} onChange={(e) => setStreet(e.target.value)} className="field-input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Suburb</label>
          <input value={suburb} onChange={(e) => setSuburb(e.target.value)} className="field-input" />
        </div>
        <div>
          <label className="field-label">Postcode</label>
          <input value={postcode} onChange={(e) => setPostcode(e.target.value)} className="field-input" />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="field-label mb-0">Notes</label>
          <VoiceInputButton
            onTranscript={(text) =>
              setNotes((prev) => (prev && !/\s$/.test(prev) ? `${prev} ${text}` : `${prev}${text}`))
            }
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input min-h-[80px]"
          placeholder="Preferences, access details, anything worth remembering"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-rig-900">
        <input type="checkbox" checked={doNotCall} onChange={(e) => setDoNotCall(e.target.checked)} />
        Do not call (opts this client out of reactivation calling)
      </label>

      {status === "error" && (
        <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
      )}
      {status === "saved" && (
        <p className="rounded bg-moss-500/10 px-3 py-2 text-sm text-moss-500">Saved.</p>
      )}

      <button type="submit" disabled={status === "saving"} className="btn-primary w-full">
        {status === "saving" ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
