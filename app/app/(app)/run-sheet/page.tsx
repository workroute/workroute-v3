import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfile } from "@/lib/supabase/auth";
import { getRunSheetBuckets } from "@/lib/run-sheet-data";
import RunSheetBoard from "./run-sheet-board";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// §32f — this is the route the bottom nav's "Run Sheet" item actually
// points to, so it's the one that needs the dashboard-style greeting, not
// just the standalone /app home page.
export default async function RunSheetPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, buckets] = await Promise.all([
    getBusinessProfile(user.id),
    getRunSheetBuckets(supabase, user.id),
  ]);

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-rig-900">
          {greeting()}{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-rig-700">Here's what's happening today.</p>

        <RunSheetBoard initialBuckets={buckets} />
      </div>
    </main>
  );
}
