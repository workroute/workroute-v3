"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/phone-utils";

type VipContact = { id: string; name: string; phone: string };

export default function PhoneAiForm({
  userId,
  initialPhoneNumberId,
  initialPhoneNumber,
  initialVipContacts,
}: {
  userId: string;
  initialPhoneNumberId: string;
  initialPhoneNumber: string;
  initialVipContacts: VipContact[];
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [numberStatus, setNumberStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [numberError, setNumberError] = useState("");

  const [vipContacts, setVipContacts] = useState(initialVipContacts);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [vipStatus, setVipStatus] = useState<"idle" | "saving" | "error">("idle");
  const [vipError, setVipError] = useState("");

  async function handleSaveNumber(e: React.FormEvent) {
    e.preventDefault();
    setNumberStatus("saving");
    setNumberError("");

    const supabase = createClient();
    const { error } = await supabase
      .from("business_profiles")
      .update({
        vapi_phone_number_id: phoneNumberId.trim() || null,
        vapi_phone_number: phoneNumber.trim() || null,
      })
      .eq("user_id", userId);

    if (error) {
      setNumberStatus("error");
      setNumberError(error.message);
      return;
    }
    setNumberStatus("saved");
  }

  async function handleAddVip(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    setVipStatus("saving");
    setVipError("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("vip_contacts")
      .insert({
        business_id: userId,
        name: newName.trim(),
        phone: newPhone.trim(),
        phone_normalized: normalizePhone(newPhone),
      })
      .select("id, name, phone")
      .single();

    if (error || !data) {
      setVipStatus("error");
      setVipError(error?.message ?? "Couldn't save that contact.");
      return;
    }

    setVipContacts((prev) => [...prev, data]);
    setNewName("");
    setNewPhone("");
    setVipStatus("idle");
  }

  async function handleRemoveVip(id: string) {
    const supabase = createClient();
    setVipContacts((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("vip_contacts").delete().eq("id", id);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSaveNumber} className="space-y-4">
        <div>
          <p className="font-display font-semibold text-rig-900">Connected Vapi number</p>
          <p className="mt-1 text-xs text-rig-700/70">
            Provision the phone number in your Vapi dashboard first, point its Server URL at this app's
            /api/vapi/webhook endpoint, then paste the number's ID here so WorkRoute knows this number is yours.
          </p>
        </div>
        <div>
          <label className="field-label">Vapi phone number ID</label>
          <input
            value={phoneNumberId}
            onChange={(e) => {
              setPhoneNumberId(e.target.value);
              setNumberStatus("idle");
            }}
            className="field-input"
            placeholder="From the Vapi dashboard"
          />
        </div>
        <div>
          <label className="field-label">Phone number (for display)</label>
          <input
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              setNumberStatus("idle");
            }}
            className="field-input"
            placeholder="+61…"
          />
        </div>
        {numberStatus === "error" && (
          <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{numberError}</p>
        )}
        {numberStatus === "saved" && <p className="text-sm text-moss-500">Saved.</p>}
        <button type="submit" disabled={numberStatus === "saving"} className="btn-primary">
          {numberStatus === "saving" ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="border-t border-rig-900/10 pt-6">
        <p className="font-display font-semibold text-rig-900">VIP alert numbers</p>
        <p className="mt-1 text-xs text-rig-700/70">
          The AI still answers these calls like any other — you'll just get an instant SMS heads-up when one of
          these numbers calls.
        </p>

        <div className="mt-4 space-y-2">
          {vipContacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border border-rig-700/20 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-rig-900">{c.name}</p>
                <p className="text-rig-700/70">{c.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveVip(c.id)}
                className="text-sm font-medium text-rust-500 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          {vipContacts.length === 0 && <p className="text-sm text-rig-700/60">No VIP numbers yet.</p>}
        </div>

        <form onSubmit={handleAddVip} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="field-input"
                placeholder="04xx xxx xxx"
              />
            </div>
          </div>
          {vipStatus === "error" && (
            <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{vipError}</p>
          )}
          <button type="submit" disabled={vipStatus === "saving"} className="btn-primary">
            {vipStatus === "saving" ? "Adding…" : "Add VIP number"}
          </button>
        </form>
      </div>
    </div>
  );
}
