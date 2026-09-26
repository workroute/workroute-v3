"use client";

import { useState } from "react";

type Business = {
  user_id: string;
  business_name: string;
  trade: string;
  city: string | null;
  vapi_phone_number: string | null;
};

type AvailableNumber = {
  id: number;
  number: string;
  cityName: string | null;
  countryName: string | null;
  monthlyFee: number | null;
  activationFee: number | null;
};

// §admin-number-provisioning — owner-only (page.tsx already gates on
// ADMIN_USER_ID before rendering this at all). Replaces the fully manual
// "buy on DIDLogic, curl Vapi, paste the ID" process with one panel: pick a
// tradie, search DIDLogic's real AU inventory, buy and wire it up in one
// click. Tradies never see this — it only renders on the owner's own
// account.
export default function AdminNumberProvisioner({ businesses }: { businesses: Business[] }) {
  const [selectedBusinessId, setSelectedBusinessId] = useState(businesses[0]?.user_id ?? "");
  const [city, setCity] = useState("");
  const [searchStatus, setSearchStatus] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [balance, setBalance] = useState<number | null>(null);

  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [buyResult, setBuyResult] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedBusiness = businesses.find((b) => b.user_id === selectedBusinessId);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchStatus("searching");
    setSearchError("");
    setBuyResult(null);

    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());

    const res = await fetch(`/api/admin/phone-numbers/search?${params.toString()}`);
    const data = await res.json();

    if (!data.ok) {
      setSearchStatus("error");
      setSearchError(data.error ?? "Search failed.");
      return;
    }

    setResults(data.numbers ?? []);
    setBalance(data.balance ?? null);
    setSearchStatus("done");
  }

  async function handleBuy(n: AvailableNumber) {
    if (!selectedBusinessId) return;
    setBuyingId(n.id);
    setBuyResult(null);

    const res = await fetch("/api/admin/phone-numbers/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessUserId: selectedBusinessId,
        didId: n.id,
        didNumber: n.number,
        monthlyFee: n.monthlyFee,
      }),
    });
    const data = await res.json();
    setBuyingId(null);

    if (!data.ok) {
      setBuyResult({ ok: false, message: `Failed at "${data.step ?? "unknown step"}": ${data.error}` });
      return;
    }
    setBuyResult({ ok: true, message: `${data.number} is now connected to ${data.business}.` });
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-amber-600">Owner only</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-rig-900">Buy a number for a tradie</h2>
      <p className="mt-1 text-sm text-rig-700">
        Searches DIDLogic's real Australian number inventory and wires the one you pick straight to Vapi — no
        manual curl calls, no copy-pasting an ID.
      </p>

      <div className="mt-4">
        <label className="field-label">Business</label>
        <select
          value={selectedBusinessId}
          onChange={(e) => setSelectedBusinessId(e.target.value)}
          className="field-input"
        >
          {businesses.map((b) => (
            <option key={b.user_id} value={b.user_id}>
              {b.business_name} ({b.trade}) — {b.vapi_phone_number || "no number yet"}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="field-input"
          placeholder={selectedBusiness?.city ? `e.g. ${selectedBusiness.city}` : "City (optional, blank = all AU)"}
        />
        <button type="submit" disabled={searchStatus === "searching"} className="btn-primary whitespace-nowrap">
          {searchStatus === "searching" ? "Searching…" : "Search"}
        </button>
      </form>

      {searchStatus === "error" && (
        <p className="mt-2 rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{searchError}</p>
      )}

      {balance !== null && (
        <p className="mt-2 text-xs text-rig-700/70">DIDLogic balance: ${balance.toFixed(2)}</p>
      )}

      {buyResult && (
        <p
          className={`mt-3 rounded px-3 py-2 text-sm ${
            buyResult.ok ? "bg-moss-500/10 text-moss-500" : "bg-rust-500/10 text-rust-500"
          }`}
        >
          {buyResult.message}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-rig-900/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rig-900/10 bg-paper-100 text-xs uppercase tracking-wide text-rig-700/70">
                <th className="px-3 py-2 font-medium">Number</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Monthly</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {results.map((n) => (
                <tr key={n.id} className="border-b border-rig-900/5 last:border-0">
                  <td className="px-3 py-2 font-mono">{n.number}</td>
                  <td className="px-3 py-2 text-rig-700">{n.cityName ?? "—"}</td>
                  <td className="px-3 py-2 text-rig-700">
                    {n.monthlyFee !== null ? `$${n.monthlyFee.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleBuy(n)}
                      disabled={buyingId !== null || !selectedBusinessId}
                      className="rounded border border-rig-700/20 bg-white px-3 py-1.5 text-xs font-medium text-rig-900 hover:bg-paper-100 disabled:opacity-50"
                    >
                      {buyingId === n.id ? "Buying…" : "Buy & connect"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
