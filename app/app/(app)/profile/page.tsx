import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";
import NotificationsToggle from "./notifications-toggle";

export default async function ProfilePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-rig-900">Business profile</h1>
            <p className="mt-1 text-sm text-rig-700">
              This is what shows up on quotes and invoices you send from WorkRoute.
            </p>
          </div>
          <Link href="/app/jobs/new" className="btn-primary whitespace-nowrap">
            Capture a job
          </Link>
        </div>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <ProfileForm userId={user.id} initialProfile={profile} />
        </div>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <NotificationsToggle userId={user.id} />
        </div>

        <div className="mt-6 flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <p className="font-display font-semibold text-rig-900">Pricing setup</p>
            <p className="mt-1 text-sm text-rig-700">
              Set base price/duration and per-answer adjustments so job estimates calculate themselves.
            </p>
          </div>
          <Link href="/app/pricing" className="btn-primary whitespace-nowrap">
            Set up pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
