import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhoneAiForm from "./phone-ai-form";
import AdminNumberProvisioner from "./admin-number-provisioner";

// §25/§34a — connecting a Vapi number to this business (manual, one-time,
// done from the Vapi dashboard first — see the field's own help text below)
// and the VIP alert number list. Both live together since they're the only
// two phone-AI-specific settings a tradie needs to touch.
export default async function PhoneAiSettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.id === process.env.ADMIN_USER_ID;

  const [{ data: profile }, { data: vipContacts }, { data: allBusinesses }] = await Promise.all([
    supabase
      .from("business_profiles")
      .select("vapi_phone_number_id, vapi_phone_number, trade")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("vip_contacts")
      .select("id, name, phone")
      .eq("business_id", user.id)
      .order("created_at", { ascending: true }),
    isAdmin
      ? supabase
          .from("business_profiles")
          .select("user_id, business_name, trade, city, vapi_phone_number")
          .order("business_name", { ascending: true })
      : Promise.resolve({ data: null }),
  ]);

  return (
    <main className="min-h-screen bg-paper-50 pb-16 md:pb-0">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/settings" className="text-sm font-medium text-steel-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">Phone AI</h1>
        <p className="mt-1 text-sm text-rig-700">
          Your AI answers every call by default (§5.1) — set up the connected number and who should trigger an
          instant heads-up SMS.
        </p>

        {profile?.trade !== "Lawn Mowing" && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-rig-900">
            The AI will still answer and capture job details for {profile?.trade ?? "your trade"} — it just can't
            calculate a live price yet, so calls land as "Quote required" until pricing is configured for this
            trade.
          </div>
        )}

        {isAdmin && (
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <AdminNumberProvisioner businesses={allBusinesses ?? []} />
          </div>
        )}

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <PhoneAiForm
            userId={user.id}
            initialPhoneNumberId={profile?.vapi_phone_number_id ?? ""}
            initialPhoneNumber={profile?.vapi_phone_number ?? ""}
            initialVipContacts={vipContacts ?? []}
          />
        </div>
      </div>
    </main>
  );
}
