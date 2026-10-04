import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFixedLocationTrade } from "@/lib/trade-questions";
import TripLogReport from "./trip-log-report";

export default async function ReportsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Salons / massage don't travel to clients, so there's no trip log to show.
  const { data: profile } = await supabase.from("business_profiles").select("trade").eq("user_id", user.id).maybeSingle();
  const showTripLog = !isFixedLocationTrade(profile?.trade);

  const { data: trips } = showTripLog
    ? await supabase
        .from("trip_logs")
        .select("id, trip_date, origin_label, destination_label, distance_km, reason")
        .eq("business_id", user.id)
        .order("trip_date", { ascending: false })
    : { data: [] };

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-rig-900">Reports</h1>

        {showTripLog && <TripLogReport trips={trips ?? []} />}

        <div className="mt-6 rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="font-medium text-rig-900">More reports coming soon</p>
          <p className="mt-1 text-sm text-rig-700">
            Won/Lost trends, job volume, and revenue reporting are on the way.
          </p>
        </div>
      </div>
    </main>
  );
}
