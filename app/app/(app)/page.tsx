import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser, getBusinessProfile } from "@/lib/supabase/auth";
import { getWeather } from "@/lib/weather";
import { getRunSheetBuckets } from "@/lib/run-sheet-data";
import RunSheetBoard from "./run-sheet/run-sheet-board";
import InstallPrompt from "./install-prompt";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// §27 — the dashboard: greeting + weather up top, then the same
// Needs-Attention / Unscheduled / Run Sheet rendering as the standalone
// /run-sheet page (reused via RunSheetBoard, not duplicated).
export default async function HomePage() {
  const {
    data: { user },
  } = await getAuthedUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();
  const [{ data: profile }, buckets] = await Promise.all([
    getBusinessProfile(user.id),
    getRunSheetBuckets(supabase, user.id),
  ]);

  const weather = await getWeather(profile?.city ?? null);

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <InstallPrompt />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-rig-900">
              {greeting()}{profile?.first_name ? `, ${profile.first_name}` : ""}
            </h1>
            <p className="text-sm text-rig-700">Here's what's happening today.</p>
          </div>
          {weather && (
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xl">{weather.icon}</span>
              <span className="text-sm text-rig-900">
                {weather.tempC}°C <span className="text-rig-700">· {weather.description}</span>
              </span>
            </div>
          )}
        </div>

        <RunSheetBoard initialBuckets={buckets} />
      </div>
    </main>
  );
}
