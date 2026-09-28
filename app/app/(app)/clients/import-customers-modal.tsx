"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// §crm-import — the inverse of clients-table.tsx's "Download customers"
// export: lets a tradie switching from another CRM (ServiceM8, Tradify,
// Fergus, Jobber, etc.) bring their existing customer list across instead
// of starting from zero. Deliberately a generic CSV importer with manual
// column mapping rather than per-CRM parsing logic — every CRM's export
// format is different, but "pick which column is the name/phone/etc." works
// for all of them without WorkRoute needing to know about any specific one.
// Only customer records (name/phone/email/address/notes) — full job
// history, invoices, and photos aren't something a generic CSV can capture
// reliably across different CRMs.

type TargetField = "name" | "phone" | "email" | "address_street" | "address_suburb" | "address_postcode" | "notes";

const FIELD_LABELS: Record<TargetField, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  address_street: "Street address",
  address_suburb: "Suburb",
  address_postcode: "Postcode",
  notes: "Notes",
};

// Common header names seen across CRM exports — used only to pre-fill a
// best guess; the tradie can always correct it before importing.
const FIELD_ALIASES: Record<TargetField, string[]> = {
  name: ["name", "customer name", "client name", "full name", "contact name", "contact"],
  phone: ["phone", "mobile", "phone number", "mobile number", "contact number", "cell"],
  email: ["email", "email address"],
  address_street: ["address", "street", "street address", "address line 1", "address 1"],
  address_suburb: ["suburb", "city", "town"],
  address_postcode: ["postcode", "post code", "zip", "zip code"],
  notes: ["notes", "note", "comments", "description"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
}

function guessColumn(headers: string[], field: TargetField): string {
  const normalized = headers.map(normalizeHeader);
  for (const alias of FIELD_ALIASES[field]) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return "";
}

// A plain, reasonably-robust CSV parser — handles quoted fields with
// embedded commas/newlines and "" escaped quotes, which covers every real
// CRM export this needs to work with; not a full RFC4180 implementation.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

type Step = "upload" | "map" | "importing" | "done";

export default function ImportCustomersModal({
  existingPhones,
  onClose,
}: {
  existingPhones: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<TargetField, string>>({
    name: "",
    phone: "",
    email: "",
    address_street: "",
    address_suburb: "",
    address_postcode: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imported: number; skippedDuplicate: number; skippedNoName: number } | null>(
    null
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setError("Couldn't find any rows in that file — make sure it's a CSV with a header row.");
        return;
      }
      const [headerRow, ...rows] = parsed;
      setHeaders(headerRow);
      setDataRows(rows);
      const guessed = {} as Record<TargetField, string>;
      (Object.keys(FIELD_LABELS) as TargetField[]).forEach((f) => {
        guessed[f] = guessColumn(headerRow, f);
      });
      setMapping(guessed);
      setStep("map");
    };
    reader.readAsText(file);
  }

  function columnValue(row: string[], column: string): string {
    if (!column) return "";
    const idx = headers.indexOf(column);
    return idx === -1 ? "" : (row[idx] ?? "").trim();
  }

  async function handleImport() {
    if (!mapping.name) {
      setError("Pick which column has the customer's name before importing.");
      return;
    }
    setStep("importing");
    setError("");

    const seenPhones = new Set(existingPhones.filter(Boolean));
    const toInsert: Record<string, unknown>[] = [];
    let skippedDuplicate = 0;
    let skippedNoName = 0;

    for (const row of dataRows) {
      const name = columnValue(row, mapping.name);
      if (!name) {
        skippedNoName++;
        continue;
      }
      const phone = columnValue(row, mapping.phone) || null;
      if (phone && seenPhones.has(phone)) {
        skippedDuplicate++;
        continue;
      }
      if (phone) seenPhones.add(phone); // also guards against the same number appearing twice in this file

      toInsert.push({
        name,
        phone,
        email: columnValue(row, mapping.email) || null,
        address_street: columnValue(row, mapping.address_street) || null,
        address_suburb: columnValue(row, mapping.address_suburb) || null,
        address_postcode: columnValue(row, mapping.address_postcode) || null,
        notes: columnValue(row, mapping.notes) || null,
      });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You've been signed out — please refresh and try again.");
      setStep("map");
      return;
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("clients")
        .insert(toInsert.map((r) => ({ ...r, business_id: user.id })));

      if (insertError) {
        setError(insertError.message);
        setStep("map");
        return;
      }
    }

    setResult({ imported: toInsert.length, skippedDuplicate, skippedNoName });
    setStep("done");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rig-950/50 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold text-rig-900">Import customers</p>
          <button type="button" onClick={onClose} className="text-rig-700/50 hover:text-rig-900" aria-label="Close">
            ✕
          </button>
        </div>

        {step === "upload" && (
          <div className="mt-4">
            <p className="text-sm text-rig-700">
              Coming from another system (ServiceM8, Tradify, Fergus, Jobber, or anywhere else)? Export your customer
              list as a CSV file there first, then upload it here.
            </p>
            <label className="mt-4 flex cursor-pointer items-center justify-center rounded border border-dashed border-rig-700/25 bg-paper-100 py-8 text-sm text-rig-700/60 hover:bg-paper-100/70">
              📄 Choose a CSV file
              <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            </label>
            {error && <p className="mt-3 rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}
          </div>
        )}

        {step === "map" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-rig-700">
              Match your file's columns to WorkRoute's fields — {dataRows.length} row{dataRows.length === 1 ? "" : "s"}{" "}
              found. Name is the only one you need.
            </p>

            <div className="space-y-2">
              {(Object.keys(FIELD_LABELS) as TargetField[]).map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-32 shrink-0 text-sm text-rig-700">
                    {FIELD_LABELS[field]}
                    {field === "name" && <span className="text-rust-500">*</span>}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                    className="field-input"
                  >
                    <option value="">— don't import —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {dataRows.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-rig-700/60">Preview</p>
                <div className="mt-1 overflow-x-auto rounded border border-rig-700/20">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-rig-700/10 bg-paper-50">
                        {(Object.keys(FIELD_LABELS) as TargetField[]).map((f) => (
                          <th key={f} className="whitespace-nowrap px-2 py-1.5 font-medium text-rig-700">
                            {FIELD_LABELS[f]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-rig-700/5 last:border-0">
                          {(Object.keys(FIELD_LABELS) as TargetField[]).map((f) => (
                            <td key={f} className="whitespace-nowrap px-2 py-1.5 text-rig-900">
                              {columnValue(row, mapping[f]) || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep("upload")} className="btn-secondary">
                Back
              </button>
              <button type="button" onClick={handleImport} className="btn-primary flex-1">
                Import {dataRows.length} customer{dataRows.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        {step === "importing" && <p className="mt-4 text-sm text-rig-700">Importing…</p>}

        {step === "done" && result && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-moss-500/20 bg-moss-500/10 p-4 text-sm text-moss-500">
              <p className="font-medium">Imported {result.imported} customer{result.imported === 1 ? "" : "s"}.</p>
              {(result.skippedDuplicate > 0 || result.skippedNoName > 0) && (
                <p className="mt-1 text-rig-700">
                  {result.skippedDuplicate > 0 && `${result.skippedDuplicate} already existed (matched by phone). `}
                  {result.skippedNoName > 0 && `${result.skippedNoName} had no name and were skipped.`}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} className="btn-primary w-full">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
