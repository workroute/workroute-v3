"use client";

export type TripLog = {
  id: string;
  trip_date: string;
  origin_label: string | null;
  destination_label: string | null;
  distance_km: number | null;
  reason: string | null;
};

function toCsv(trips: TripLog[]): string {
  const header = ["Date", "From", "To", "Kilometres", "Reason"];
  const rows = trips.map((t) => [
    t.trip_date,
    t.origin_label ?? "",
    t.destination_label ?? "",
    t.distance_km !== null ? t.distance_km.toFixed(1) : "",
    t.reason ?? "",
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default function TripLogReport({ trips }: { trips: TripLog[] }) {
  const totalKm = trips.reduce((sum, t) => sum + (t.distance_km ?? 0), 0);

  function handleExport() {
    const csv = toCsv(trips);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workroute-trip-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (trips.length === 0) {
    return (
      <div className="mt-6 rounded-lg bg-white p-6 text-center shadow-sm">
        <p className="font-medium text-rig-900">No trips logged yet</p>
        <p className="mt-1 text-sm text-rig-700">
          Every time you tap "On the way" on a job, the driving distance is logged here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-display font-semibold text-rig-900">Business kilometres</p>
          <p className="mt-1 text-sm text-rig-700">
            {trips.length} trip{trips.length === 1 ? "" : "s"} logged · {totalKm.toFixed(1)} km total
          </p>
        </div>
        <button type="button" onClick={handleExport} className="btn-primary whitespace-nowrap">
          Export CSV
        </button>
      </div>

      <p className="mt-3 rounded bg-paper-100 px-3 py-2 text-xs text-rig-700">
        This is a record of driving distance between jobs, calculated from Google Maps — not a formal ATO
        12-week logbook. It's meant to support the simpler cents-per-kilometre method. Check with your
        accountant or the ATO's own guidance for how to use it.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rig-900/10 text-xs uppercase tracking-wide text-rig-700/60">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">From</th>
              <th className="py-2 pr-4">To</th>
              <th className="py-2 pr-4">Km</th>
              <th className="py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id} className="border-b border-rig-900/5">
                <td className="py-2 pr-4 whitespace-nowrap">{trip.trip_date}</td>
                <td className="py-2 pr-4">{trip.origin_label ?? "—"}</td>
                <td className="py-2 pr-4">{trip.destination_label ?? "—"}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {trip.distance_km !== null ? trip.distance_km.toFixed(1) : "—"}
                </td>
                <td className="py-2">{trip.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
