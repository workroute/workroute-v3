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

  // §quick-start-vs-full-setup — same "has real pricing been configured"
  // check Owner Overview uses (a starting_price fallback counts too, same
  // as job-form.tsx/[id]/page.tsx's own quote_required display logic) — a
  // brand-new tradie landing here straight from the welcome quick-start
  // form has neither, so they see the callout below; it disappears for good
  // once they've actually set pricing up, since the choice no longer applies.
  const { data: pricingConfig } = await supabase
    .from("trade_pricing_configs")
    .select("business_id")
    .eq("business_id", user.id)
    .maybeSingle();
  const hasPricing = !!pricingConfig || !!profile?.starting_price;

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div>
          <h1 className="font-display text-2xl font-bold text-rig-900">Business profile</h1>
          <p className="mt-1 text-sm text-rig-700">
            This is what shows up on quotes and invoices you send from WorkRoute.
          </p>
        </div>

        {!hasPricing && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-rig-900">
            <p className="font-medium">✅ Quick start — this is all you need.</p>
            <p className="mt-1 text-rig-700">
              With this filled in, Sarah can already answer calls, capture the job, and book a visit in. Want her
              quoting a real price on the call too, instead of just taking the job down? Set up Pricing further down
              this page — worth it, but optional.
            </p>
          </div>
        )}

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <ProfileForm userId={user.id} initialProfile={profile} />
        </div>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <NotificationsToggle userId={user.id} />
        </div>

        <div className="mt-6 flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <p className="font-display font-semibold text-rig-900">
              Pricing setup {!hasPricing && <span className="font-normal text-rig-700/60">(optional)</span>}
            </p>
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
