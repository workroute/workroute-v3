"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ClientOption = {
  id: string;
  name: string;
  phone: string | null;
  address_street: string | null;
  address_suburb: string | null;
  address_postcode: string | null;
};

// §19 — autocomplete by name/phone, plus a one-tap way to skip straight to
// a blank "new client" entry so client selection never slows down capturing
// a job in the field.
export default function ClientSearch({
  businessId,
  onSelect,
  onNew,
}: {
  businessId: string;
  onSelect: (client: ClientOption) => void;
  onNew: (typedName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const escaped = q.replace(/[%,]/g, "");
      const { data } = await supabase
        .from("clients")
        .select("id, name, phone, address_street, address_suburb, address_postcode")
        .eq("business_id", businessId)
        .or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
        .order("name")
        .limit(8);
      setResults((data ?? []) as ClientOption[]);
      setLoading(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [query, businessId]);

  return (
    <div>
      <label className="field-label">Client</label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="field-input"
        placeholder="Search by name or phone…"
        autoComplete="off"
      />

      {loading && <p className="mt-1 text-xs text-rig-700/60">Searching…</p>}

      {!loading && results.length > 0 && (
        <div className="mt-2 divide-y divide-rig-900/10 overflow-hidden rounded border border-rig-700/20 bg-white">
          {results.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => onSelect(c)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-paper-100"
            >
              <span className="font-medium text-rig-900">{c.name}</span>
              {c.phone && <span className="ml-2 text-rig-700">{c.phone}</span>}
              {c.address_suburb && (
                <span className="block text-xs text-rig-700/70">{c.address_suburb}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-1 text-xs text-rig-700/60">No matching clients.</p>
      )}

      <button
        type="button"
        onClick={() => onNew(query.trim())}
        className="mt-2 text-sm font-medium text-steel-500 hover:underline"
      >
        + New client
      </button>
    </div>
  );
}
