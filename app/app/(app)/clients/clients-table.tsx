"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Client } from "@/lib/clients";
import { initials } from "@/lib/avatar";

export type ClientRow = Client & {
  job_count: number;
  last_job_date: string | null;
};

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// §own-your-data — a tradie's customer list is theirs, not something they're
// locked into WorkRoute to keep. Same export pattern as the trip-log CSV in
// reports/trip-log-report.tsx: built client-side from data already on the
// page, no new API route needed. Deliberately a plain, generic CSV (not a
// WorkRoute-specific format) so it opens cleanly in HubSpot, Excel, or
// anything else a tradie might move to.
function toCsv(rows: ClientRow[]): string {
  const header = ["Name", "Phone", "Email", "Street", "Suburb", "Postcode", "Notes", "Jobs", "Last job date"];
  const csvRows = rows.map((r) => [
    r.name,
    r.phone ?? "",
    r.email ?? "",
    r.address_street ?? "",
    r.address_suburb ?? "",
    r.address_postcode ?? "",
    r.notes ?? "",
    String(r.job_count),
    r.last_job_date ?? "",
  ]);
  return [header, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.phone ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  function handleExport() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="field-input max-w-sm"
          placeholder="Search by name or phone…"
        />
        {rows.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="whitespace-nowrap rounded border border-rig-700/20 bg-white px-3 py-2 text-sm font-medium text-rig-700 hover:bg-paper-100"
          >
            Download customers
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-rig-900/10 bg-white p-6 text-center text-sm text-rig-700/60 shadow-sm">
          No clients yet — they're added automatically when you capture a job, or you can{" "}
          <Link href="/app/clients/new" className="font-medium text-steel-500 hover:underline">
            add one directly
          </Link>
          .
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-lg border border-rig-900/10 bg-white p-6 text-center text-sm text-rig-700/60 shadow-sm">
          No clients match "{query}".
        </p>
      ) : (
        <>
          {/* mobile card list, matches jobs-table.tsx's convention */}
          <div className="mt-4 space-y-3 sm:hidden">
            {filtered.map((client) => (
              <Link
                key={client.id}
                href={`/app/clients/${client.id}`}
                className="block rounded-lg border border-rig-900/10 bg-white p-4 shadow-sm hover:bg-paper-100"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-xs font-semibold text-rig-700">
                    {initials(client.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-semibold text-rig-900">{client.name}</p>
                    <p className="truncate text-sm text-rig-700">{client.address_suburb || "—"}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-rig-700">
                  <span>{client.phone || "—"}</span>
                  <span>{client.job_count} {client.job_count === 1 ? "job" : "jobs"}</span>
                  <span>Last job: {formatDate(client.last_job_date)}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-lg border border-rig-900/10 bg-white shadow-sm sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rig-900/10 text-xs uppercase tracking-wide text-rig-700/70">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Suburb</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Jobs</th>
                  <th className="px-4 py-3 font-medium">Last job</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/app/clients/${client.id}`)}
                    className="cursor-pointer border-b border-rig-900/5 last:border-0 hover:bg-paper-100"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-xs font-semibold text-rig-700">
                          {initials(client.name)}
                        </span>
                        <span className="font-medium text-rig-900">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-rig-700">{client.address_suburb || "—"}</td>
                    <td className="px-4 py-3 text-rig-700">{client.phone || "—"}</td>
                    <td className="px-4 py-3 text-rig-700">{client.job_count}</td>
                    <td className="px-4 py-3 text-rig-700">{formatDate(client.last_job_date)}</td>
                    <td className="px-4 py-3 text-right text-rig-700/40" aria-hidden="true">
                      ›
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
