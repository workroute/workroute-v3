import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFixedLocationTrade } from "@/lib/trade-questions";
import { addDays, mondayOf, weekDates } from "@/lib/calendar-data";
import {
  DEFAULT_APPOINTMENT_MINUTES,
  PX_PER_MINUTE,
  SLOT_MINUTES,
  friendlyTime,
  placeAppointments,
  toHHMM,
  toMinutes,
} from "@/lib/appointment-day";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The app is Brisbane-only for now (no per-business timezone), so "today" and
// "now" here are Brisbane's, regardless of where the server runs.
function brisbaneNow(): { today: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    today: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

const floorToSlot = (m: number) => Math.floor(m / SLOT_MINUTES) * SLOT_MINUTES;
const ceilToSlot = (m: number) => Math.ceil(m / SLOT_MINUTES) * SLOT_MINUTES;

// §salon-day-view — a front-desk page for hair and massage businesses: the day
// in half-hour rows, appointments sitting at their real times, and any empty
// slot one tap from the booking form (for walk-ins and phone bookings). Flip
// to another day with the arrows or the week strip. Read-only on its own:
// every booking still goes through the same form and chair-aware availability
// rules as Sarah and the public booking page.
export default async function AppointmentsPage({ searchParams }: { searchParams: { date?: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("trade, chairs, work_start_time, work_end_time")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !isFixedLocationTrade(profile.trade)) redirect("/app/run-sheet");

  const now = brisbaneNow();
  const date = searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : now.today;
  const isToday = date === now.today;
  const chairs = Math.max(1, Number(profile.chairs) || 1);

  const monday = mondayOf(date);
  const week = weekDates(monday);

  const [{ data: dayJobs }, { data: weekJobs }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, customer_name, job_label, scheduled_time, scheduled_block, estimated_duration_minutes, status")
      .eq("business_id", user.id)
      .eq("scheduled_date", date)
      .neq("status", "Cancelled"),
    supabase
      .from("jobs")
      .select("scheduled_date")
      .eq("business_id", user.id)
      .gte("scheduled_date", week[0])
      .lte("scheduled_date", week[6])
      .neq("status", "Cancelled"),
  ]);

  const countByDate = new Map<string, number>();
  for (const j of weekJobs ?? []) {
    countByDate.set(j.scheduled_date, (countByDate.get(j.scheduled_date) ?? 0) + 1);
  }

  const timed = (dayJobs ?? [])
    .filter((j) => j.scheduled_time)
    .map((j) => {
      const startMin = toMinutes(String(j.scheduled_time).slice(0, 5));
      const duration = j.estimated_duration_minutes ?? DEFAULT_APPOINTMENT_MINUTES;
      return {
        id: j.id as string,
        name: j.customer_name as string,
        service: (j.job_label as string | null) ?? null,
        status: j.status as string,
        startMin,
        // Real end, for the time label; endMin is at least one slot tall so a
        // short appointment is still readable and tappable.
        realEnd: startMin + duration,
        endMin: startMin + Math.max(duration, SLOT_MINUTES),
      };
    });
  const unplaced = (dayJobs ?? []).filter((j) => !j.scheduled_time);

  const hours = (value: string | null | undefined, fallback: number) =>
    value ? toMinutes(String(value).slice(0, 5)) : fallback;
  let gridStart = floorToSlot(hours(profile.work_start_time, 8 * 60));
  let gridEnd = ceilToSlot(hours(profile.work_end_time, 18 * 60));
  for (const a of timed) {
    gridStart = Math.min(gridStart, floorToSlot(a.startMin));
    gridEnd = Math.max(gridEnd, ceilToSlot(a.endMin));
  }
  if (gridEnd <= gridStart) gridEnd = gridStart + 60;

  const placed = placeAppointments(timed);
  const slots: number[] = [];
  for (let m = gridStart; m < gridEnd; m += SLOT_MINUTES) slots.push(m);

  const busyAt = (slotStart: number) =>
    timed.filter((a) => a.startMin < slotStart + SLOT_MINUTES && a.endMin > slotStart).length;

  const nowRounded = Math.ceil(now.minutes / 5) * 5;
  const walkInHref = `/app/jobs/new?date=${now.today}&time=${toHHMM(Math.min(nowRounded, 23 * 60 + 55))}`;
  const showNowLine = isToday && now.minutes >= gridStart && now.minutes < gridEnd;

  const longDate = new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const gutter = "3.5rem";
  const addStrip = "2.75rem";

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-rig-900">Appointments</h1>
            <p className="text-sm text-rig-700">
              {longDate}
              {isToday ? " (today)" : ""}
            </p>
          </div>
          <Link href={walkInHref} className="btn-primary whitespace-nowrap">
            + Walk-in now
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/app/appointments?date=${addDays(date, -1)}`}
            aria-label="Previous day"
            className="rounded-lg border border-rig-700/20 bg-white px-3 py-1.5 text-sm font-medium text-rig-900 hover:bg-paper-100"
          >
            ‹
          </Link>
          {!isToday && (
            <Link
              href="/app/appointments"
              className="rounded-lg border border-rig-700/20 bg-white px-3 py-1.5 text-sm font-medium text-rig-900 hover:bg-paper-100"
            >
              Today
            </Link>
          )}
          <Link
            href={`/app/appointments?date=${addDays(date, 1)}`}
            aria-label="Next day"
            className="rounded-lg border border-rig-700/20 bg-white px-3 py-1.5 text-sm font-medium text-rig-900 hover:bg-paper-100"
          >
            ›
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const selected = d === date;
            const count = countByDate.get(d) ?? 0;
            const label = new Date(`${d}T12:00:00`).toLocaleDateString("en-AU", { weekday: "short" });
            const dayNum = Number(d.slice(8, 10));
            return (
              <Link
                key={d}
                href={`/app/appointments?date=${d}`}
                className={`rounded-lg border px-1 py-1.5 text-center ${
                  selected ? "border-rig-900 bg-rig-900 text-paper-50" : "border-rig-700/20 bg-white text-rig-900 hover:bg-paper-100"
                }`}
              >
                <span className="block text-[11px] uppercase tracking-wide opacity-70">{label}</span>
                <span className="block text-sm font-semibold">{dayNum}</span>
                <span className={`block text-[11px] ${selected ? "opacity-80" : "text-rig-700/60"}`}>
                  {count > 0 ? count : "·"}
                </span>
              </Link>
            );
          })}
        </div>

        {unplaced.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-rig-900">
            <p className="font-medium">No set time</p>
            <ul className="mt-1 space-y-1">
              {unplaced.map((j) => (
                <li key={j.id}>
                  <Link href={`/app/jobs/${j.id}`} className="text-steel-500 hover:underline">
                    {j.customer_name}
                  </Link>
                  {j.scheduled_block ? ` · ${j.scheduled_block}` : ""}
                  {j.job_label ? ` · ${j.job_label}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-lg border border-rig-900/10 bg-white shadow-sm">
          <div className="relative" style={{ height: (gridEnd - gridStart) * PX_PER_MINUTE }}>
            {slots.map((m) => {
              const full = busyAt(m) >= chairs;
              const top = (m - gridStart) * PX_PER_MINUTE;
              return (
                <div
                  key={m}
                  className="absolute inset-x-0 flex border-t border-rig-900/10"
                  style={{ top, height: SLOT_MINUTES * PX_PER_MINUTE }}
                >
                  <span className="shrink-0 pr-2 pt-1 text-right text-[11px] text-rig-700/60" style={{ width: gutter }}>
                    {friendlyTime(m)}
                  </span>
                  <Link
                    href={`/app/jobs/new?date=${date}&time=${toHHMM(m)}`}
                    aria-label={`Add an appointment at ${friendlyTime(m)}${full ? " (slot is full)" : ""}`}
                    className="flex-1 hover:bg-amber-500/10"
                  >
                    <span className="float-right pr-3 pt-1 text-xs text-rig-700/40">{full ? "full" : "+"}</span>
                  </Link>
                </div>
              );
            })}

            {placed.map((a) => {
              const done = a.status === "Completed";
              return (
                <Link
                  key={a.id}
                  href={`/app/jobs/${a.id}`}
                  className={`absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight ${
                    done
                      ? "border-moss-500/30 bg-moss-500/10 text-rig-700"
                      : "border-steel-500/40 bg-steel-500/15 text-rig-900"
                  }`}
                  style={{
                    top: (a.startMin - gridStart) * PX_PER_MINUTE + 1,
                    height: (a.endMin - a.startMin) * PX_PER_MINUTE - 2,
                    left: `calc(${gutter} + (100% - ${gutter} - ${addStrip}) * ${a.lane} / ${a.lanes} + 2px)`,
                    width: `calc((100% - ${gutter} - ${addStrip}) / ${a.lanes} - 4px)`,
                  }}
                >
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block truncate text-rig-700">
                    {friendlyTime(a.startMin)}–{friendlyTime(a.realEnd)}
                    {a.service ? ` · ${a.service}` : ""}
                  </span>
                </Link>
              );
            })}

            {showNowLine && (
              <div
                className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-amber-500"
                style={{ top: (now.minutes - gridStart) * PX_PER_MINUTE }}
              />
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-rig-700/60">
          Tap any empty slot to add someone. {chairs > 1 ? `Up to ${chairs} appointments can overlap. ` : ""}A slot
          marked "full" can still be booked, you'll be offered the nearest free times first.
        </p>
      </div>
    </main>
  );
}
