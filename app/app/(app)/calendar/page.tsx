import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mondayOf, addDays, getCalendarWeek } from "@/lib/calendar-data";
import { IconCalendar, IconSparkle } from "../nav-icons";

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatRange(monday: string, sunday: string): string {
  const m = new Date(`${monday}T00:00:00`);
  const s = new Date(`${sunday}T00:00:00`);
  const start = m.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const end = s.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  return `${start} – ${end}`;
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

// §32 — "What does my week look like?" A genuinely different view from the
// Run Sheet (today-only operational detail): just jobs-per-day counts, no
// per-job cards, no reschedule UI here. Tapping a day hands off to
// /app/jobs?date=, which already exists to receive exactly this. Nav stays
// exactly as Stage 1 built it (Run Sheet | Messages | + | Calendar | More) —
// this page's own content doesn't change that. No travel-time/routing
// hints, same boundary as §32b for the Run Sheet.
//
// §32d — visual polish pass matching the approved mockups' card style,
// spacing, and icon-badge language, kept on the existing amber/rig palette
// (not any mockup's own alternate colors) and the existing week-count
// content — no hours-booked totals, no AI capacity banner, no "+ Add job"
// here; those are new functionality, not styling, and out of this pass.
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentMonday = mondayOf(today);
  const monday = searchParams.week ? mondayOf(searchParams.week) : currentMonday;
  const sunday = addDays(monday, 6);
  const isCurrentWeek = monday === currentMonday;

  const days = await getCalendarWeek(supabase, user.id, monday);

  const prevMonday = addDays(monday, -7);
  const nextMonday = addDays(monday, 7);

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-rig-900">Calendar</h1>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Link
            href={`/app/calendar?week=${prevMonday}`}
            className="text-sm font-medium text-steel-500 hover:underline"
          >
            ‹ Previous week
          </Link>
          <div className="text-center">
            <p className="font-display font-semibold text-rig-900">{formatRange(monday, sunday)}</p>
            {!isCurrentWeek && (
              <Link href="/app/calendar" className="text-xs font-medium text-steel-500 hover:underline">
                Back to this week
              </Link>
            )}
          </div>
          <Link
            href={`/app/calendar?week=${nextMonday}`}
            className="text-sm font-medium text-steel-500 hover:underline"
          >
            Next week ›
          </Link>
        </div>

        <div className="mt-5 space-y-2.5">
          {days.map((day) => {
            const isToday = day.date === today;
            const isEmpty = day.count === 0;
            const weekend = isWeekend(day.date);

            return (
              <Link
                key={day.date}
                href={`/app/jobs?date=${day.date}`}
                className={`flex items-center justify-between gap-3 rounded-lg p-4 shadow-sm transition-colors ${
                  isToday
                    ? "border-2 border-amber-500 bg-amber-500/10 hover:bg-amber-500/15"
                    : "border border-rig-900/10 bg-white hover:bg-paper-100"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                      isToday ? "bg-amber-500/20 text-amber-600" : "bg-rig-900/5 text-rig-700/60"
                    }`}
                  >
                    {isToday ? <IconSparkle /> : <IconCalendar />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-rig-900">{formatDay(day.date)}</span>
                      {isToday && (
                        <span className="whitespace-nowrap rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-600">
                          Today
                        </span>
                      )}
                      {!isToday && isEmpty && !weekend && (
                        <span className="whitespace-nowrap rounded-full bg-moss-500/10 px-2 py-0.5 text-xs font-medium text-moss-500">
                          Good day for new jobs
                        </span>
                      )}
                      {day.flagged && (
                        <span className="whitespace-nowrap rounded-full border border-rust-500/40 bg-rust-500/10 px-2 py-0.5 text-xs font-medium text-rust-500">
                          Needs attention
                        </span>
                      )}
                    </div>
                    {isEmpty && weekend && !isToday && (
                      <p className="mt-0.5 text-xs text-rig-700/50">No jobs scheduled</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="whitespace-nowrap text-sm text-rig-700">
                    {isEmpty ? "No jobs" : `${day.count} job${day.count === 1 ? "" : "s"}`}
                  </span>
                  <span className="text-rig-700/40" aria-hidden="true">
                    ›
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
