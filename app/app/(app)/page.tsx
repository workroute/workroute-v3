import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser, getBusinessProfile } from "@/lib/supabase/auth";
import { getWeather } from "@/lib/weather";
import { getRunSheetBuckets } from "@/lib/run-sheet-data";
import { loadTradePricingConfig } from "@/lib/trade-pricing";
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

  // §staged-onboarding — a business that stopped after the Quick Start
  // screen (just name/business/trade) can still take calls, but Sarah
  // can't quote anything until either the full pricing matrix or a
  // starting_price fallback exists (lib/phone-ai.ts's three-way pricing
  // branch). Gentle, dismissible-by-completing reminder, not an error.
  const pricingConfig = profile ? await loadTradePricingConfig(supabase, user.id, profile.trade) : null;
  const showPricingReminder = !!profile && !pricingConfig && !profile.starting_price;

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <InstallPrompt />

        {showPricingReminder && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-rig-900">
            <span>Sarah can't quote prices yet — add your pricing to get the most out of her.</span>
            <Link href="/app/pricing" className="font-medium text-steel-500 hover:underline whitespace-nowrap">
              Set up pricing →
            </Link>
          </div>
        )}

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
