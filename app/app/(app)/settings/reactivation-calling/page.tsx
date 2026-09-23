import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLapsedClients } from "@/lib/reactivation";
import ReactivationForm from "./reactivation-form";

// §38 — manual review + trigger, not a cron. See 0017_reactivation_calling.sql
// for why: no scheduler is wired up anywhere in this app yet, and a human
// reviewing who gets called is the safer default for a feature that places
// real phone calls to real people.
export default async function ReactivationCallingSettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("reactivation_lapsed_months, vapi_phone_number_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const lapsedMonths = profile?.reactivation_lapsed_months ?? 6;
  const lapsedClients = await getLapsedClients(supabase, user.id, lapsedMonths);

  return (
    <main className="min-h-screen bg-paper-50 pb-16 md:pb-0">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/settings" className="text-sm font-medium text-steel-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">Reactivation calling</h1>
        <p className="mt-1 text-sm text-rig-700">
          Sarah can call clients who haven't booked in a while to offer them a spot — you choose who, nothing goes
          out automatically.
        </p>

        {!profile?.vapi_phone_number_id && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-rig-900">
            Connect a Vapi number in{" "}
            <Link href="/app/settings/phone-ai" className="font-medium underline">
              Settings &gt; Phone AI
            </Link>{" "}
            before calling clients from here.
          </div>
        )}

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <ReactivationForm
            userId={user.id}
            initialLapsedMonths={lapsedMonths}
            initialLapsedClients={lapsedClients}
            hasVapiNumber={!!profile?.vapi_phone_number_id}
          />
        </div>
      </div>
    </main>
  );
}
