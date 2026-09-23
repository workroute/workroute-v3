import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTradePricingConfig } from "@/lib/trade-pricing";
import JobForm from "./job-form";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("trade, business_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper-50 px-4">
        <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="font-display font-semibold text-rig-900">
            Set up your business profile first
          </p>
          <p className="mt-2 text-sm text-rig-700">
            WorkRoute needs to know your trade before it can show the right
            job questions.
          </p>
          <Link href="/app/profile" className="btn-primary mt-4 inline-flex">
            Go to business profile
          </Link>
        </div>
      </main>
    );
  }

  // §31 — if this trade has pricing configured, the job form calculates its
  // own estimate from the trade answers instead of the tradie typing one in.
  const pricingConfig = await loadTradePricingConfig(supabase, user.id, profile.trade);

  // §book-from-client — arriving here from a client's own profile page
  // ("+ New Job" there) skips the search step entirely, since the tradie's
  // already looking right at who they want to book.
  let initialClient = null;
  if (searchParams.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, phone, address_street, address_suburb, address_postcode")
      .eq("id", searchParams.clientId)
      .eq("business_id", user.id)
      .maybeSingle();
    initialClient = client;
  }

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-rig-900">Capture a job</h1>
        <p className="mt-1 text-sm text-rig-700">
          Get the essentials down while it's fresh. You can fill in the rest later.
        </p>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <JobForm businessId={user.id} trade={profile.trade} pricingConfig={pricingConfig} initialClient={initialClient} />
        </div>
      </div>
    </main>
  );
}
