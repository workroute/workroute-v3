// §27 — dashboard weather widget. Server-only: reads OPENWEATHERMAP_API_KEY
// from process.env directly, so this must never be imported from a
// "use client" component. Same approach as the user's other project,
// SameNot — a plain city name typed in at profile setup, passed straight
// to OpenWeatherMap, no geocoding.

export type Weather = {
  tempC: number;
  description: string;
  icon: string;
};

// OpenWeatherMap icon codes -> plain emoji. Avoids hotlinking their icon
// images — matches this codebase's existing convention of plain
// unicode/text for every icon-like affordance (no icon library, no
// external image dependency), and keeps the widget working the same way
// this PWA's other cached content does.
const ICON_MAP: Record<string, string> = {
  "01": "☀️",
  "02": "⛅",
  "03": "☁️",
  "04": "☁️",
  "09": "🌧️",
  "10": "🌧️",
  "11": "⛈️",
  "13": "❄️",
  "50": "🌫️",
};

function emojiFor(owmIcon: string): string {
  return ICON_MAP[owmIcon.slice(0, 2)] ?? "🌤️";
}

// Never throws — a missing key, unset city, or any API/network failure
// just means no widget renders, same resilience pattern already used for
// SMS/AI failures elsewhere in this app.
export async function getWeather(city: string | null): Promise<Weather | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey || !city?.trim()) return null;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`,
      { next: { revalidate: 600 } } // weather doesn't need to be fetched on every request
    );
    if (!res.ok) return null;

    const data = await res.json();
    const weather = data?.weather?.[0];
    if (typeof data?.main?.temp !== "number" || !weather) return null;

    return {
      tempC: Math.round(data.main.temp),
      description: weather.description ?? "",
      icon: emojiFor(weather.icon ?? ""),
    };
  } catch {
    return null;
  }
}

// §44 — a real forecast description for one specific date (not just a
// yes/no warning), used by the afternoon "tomorrow's jobs" briefing so the
// tradie sees an actual reason, not just an alarm. Picks the forecast slot
// closest to midday on that date as the representative reading, and reports
// the highest rain probability seen across that day's slots.
export async function getForecastSummary(city: string, date: string): Promise<string | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey || !city?.trim()) return null;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const list: { dt_txt: string; pop: number; main: { temp: number }; weather: { description: string }[] }[] =
      data?.list ?? [];
    const daySlots = list.filter((slot) => slot.dt_txt?.slice(0, 10) === date);
    if (daySlots.length === 0) return null;

    const midday = daySlots.reduce((closest, slot) => {
      const hour = Number(slot.dt_txt.slice(11, 13));
      const closestHour = Number(closest.dt_txt.slice(11, 13));
      return Math.abs(hour - 12) < Math.abs(closestHour - 12) ? slot : closest;
    }, daySlots[0]);

    const maxPop = Math.round(Math.max(...daySlots.map((s) => s.pop)) * 100);
    const description = midday.weather?.[0]?.description ?? "";
    const tempC = Math.round(midday.main.temp);

    return `${description}, around ${tempC}°C, ${maxPop}% chance of rain`;
  } catch {
    return null;
  }
}

const WARNING_CONDITIONS = new Set(["Rain", "Thunderstorm", "Snow"]);

// Free-tier 5-day/3-hour forecast — no lat/lon geocoding needed, same plain
// city-name input as getWeather(). Returns true if ANY forecast slot on any
// of `dates` looks bad (pop >= 0.5, or a Rain/Thunderstorm/Snow category) —
// no per-trade filtering in this first version, refine later if needed.
// Uses server UTC dates for "today"/"tomorrow", consistent with
// lib/run-sheet.ts's todayStr()/tomorrowStr() — a known simplification.
export async function getForecastWarning(city: string, dates: string[]): Promise<boolean> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey || !city?.trim()) return false;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return false;

    const data = await res.json();
    const list: { dt_txt: string; pop: number; weather: { main: string }[] }[] = data?.list ?? [];

    return list.some((slot) => {
      const slotDate = slot.dt_txt?.slice(0, 10);
      if (!dates.includes(slotDate)) return false;
      const category = slot.weather?.[0]?.main;
      return slot.pop >= 0.5 || (category && WARNING_CONDITIONS.has(category));
    });
  } catch {
    return false;
  }
}
