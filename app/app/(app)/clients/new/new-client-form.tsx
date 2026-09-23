"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewClientForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const supabase = createClient();
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        business_id: businessId,
        name,
        phone: phone || null,
        address_street: street || null,
        address_suburb: suburb || null,
        address_postcode: postcode || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error || !client) {
      setStatus("error");
      setErrorMessage(error?.message ?? "Couldn't save the client. Try again.");
      return;
    }

    router.push(`/app/clients/${client.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="field-label">Name</label>
        <input
          required
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Contact number</label>
        <input
          type="tel"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="field-input"
          placeholder="04xx xxx xxx"
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
        <label className="field-label">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input min-h-[80px]"
          placeholder="Preferences, access details, anything worth remembering"
        />
      </div>

      {status === "error" && (
        <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
      )}

      <button type="submit" disabled={status === "saving"} className="btn-primary w-full">
        {status === "saving" ? "Saving…" : "Add client"}
      </button>
    </form>
  );
}
