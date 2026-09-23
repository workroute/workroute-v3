import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkHoursForm from "./work-hours-form";

// §32e/§32d — the raw field only; Calendar's actual capacity math (hours
// booked vs. hours available) is separate, deferred work that will read
// this once built.
export default async function WorkHoursPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("work_start_time, work_end_time")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/settings" className="text-sm font-medium text-steel-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">Work hours</h1>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <WorkHoursForm
            userId={user.id}
            initialStart={profile?.work_start_time ?? null}
            initialEnd={profile?.work_end_time ?? null}
          />
        </div>
      </div>
    </main>
  );
}
