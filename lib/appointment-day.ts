// Layout helpers for the salon day view (app/app/(app)/appointments).

export const SLOT_MINUTES = 30;
export const PX_PER_MINUTE = 1.5;
// Appointments with no saved duration are treated as an hour, the same
// fallback the salon scheduling rules use.
export const DEFAULT_APPOINTMENT_MINUTES = 60;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function friendlyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

export type PlacedAppointment<T> = T & { lane: number; lanes: number };

// Sits overlapping appointments side by side (a salon with three chairs can
// have three at once). Appointments that overlap each other form a cluster
// and share that cluster's width; an appointment with nothing overlapping it
// gets the full width.
export function placeAppointments<T extends { startMin: number; endMin: number }>(
  items: T[]
): PlacedAppointment<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const placed: PlacedAppointment<T>[] = [];

  let cluster: PlacedAppointment<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  function closeCluster() {
    for (const item of cluster) item.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  }

  for (const item of sorted) {
    if (item.startMin >= clusterEnd && cluster.length > 0) closeCluster();

    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }

    const entry = { ...item, lane, lanes: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  closeCluster();

  return placed;
}
