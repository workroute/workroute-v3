import type { SupabaseClient } from "@supabase/supabase-js";

// §32 — Calendar week view. Monday-start week math, done with plain UTC
// Date arithmetic — same convention lib/run-sheet.ts's todayStr() already
// uses (no date library in this project, and not the place to introduce
// one). This doesn't correct that convention's existing UTC-vs-AU-local
// quirk around midnight — it just stays consistent with it, so Calendar and
// Run Sheet agree on what "today" is.

export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekDates(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}

export type CalendarDay = { date: string; count: number; flagged: boolean };

// Counts only — no per-job detail, per the redesign's "what does my week
// look like" framing. Day-drill-down for actual job detail happens at
// /app/jobs?date=, not here.
export async function getCalendarWeek(
  supabase: SupabaseClient,
  businessId: string,
  mondayStr: string
): Promise<CalendarDay[]> {
  const days = weekDates(mondayStr);

  const { data } = await supabase
    .from("jobs")
    .select("scheduled_date, attention_priority")
    .eq("business_id", businessId)
    .gte("scheduled_date", days[0])
    .lte("scheduled_date", days[6]);

  const byDate = new Map<string, { count: number; flagged: boolean }>();
  for (const job of data ?? []) {
    const entry = byDate.get(job.scheduled_date) ?? { count: 0, flagged: false };
    entry.count += 1;
    if (job.attention_priority !== null) entry.flagged = true;
    byDate.set(job.scheduled_date, entry);
  }

  return days.map((date) => ({
    date,
    count: byDate.get(date)?.count ?? 0,
    flagged: byDate.get(date)?.flagged ?? false,
  }));
}
