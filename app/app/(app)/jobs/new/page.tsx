import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTradePricingConfig } from "@/lib/trade-pricing";
import { isFixedLocationTrade, staffPreference } from "@/lib/trade-questions";
import JobForm from "./job-form";
import AppointmentForm from "./appointment-form";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: { clientId?: string; rebookFrom?: string; date?: string; time?: string };
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
    .select("trade, business_name, staff_names")
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

  // Salon / massage: a short appointment form instead of the tradie job form.
  // "Book again" arrives with ?rebookFrom=<job> (or just ?clientId=), and the
  // service + preferred stylist from their most recent visit are pre-filled,
  // so a regular rebooking is one date/time away.
  if (isFixedLocationTrade(profile.trade)) {
    let previousAnswers: Record<string, any> = {};
    let clientForForm = initialClient ? { id: initialClient.id, name: initialClient.name, phone: initialClient.phone } : null;

    if (searchParams.rebookFrom) {
      const { data: prev } = await supabase
        .from("jobs")
        .select("client_id, customer_name, customer_phone, trade_answers")
        .eq("id", searchParams.rebookFrom)
        .eq("business_id", user.id)
        .maybeSingle();
      if (prev) {
        previousAnswers = prev.trade_answers ?? {};
        if (!clientForForm && prev.client_id) {
          clientForForm = { id: prev.client_id, name: prev.customer_name, phone: prev.customer_phone };
        }
      }
    } else if (initialClient) {
      const { data: last } = await supabase
        .from("jobs")
        .select("trade_answers")
        .eq("client_id", initialClient.id)
        .eq("business_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      previousAnswers = last?.trade_answers ?? {};
    }

    return (
      <main className="min-h-screen bg-paper-50">
        <div className="mx-auto max-w-lg px-4 py-10">
          <h1 className="font-display text-2xl font-bold text-rig-900">Book an appointment</h1>
          <p className="mt-1 text-sm text-rig-700">
            {clientForForm ? "Same as last time. Just pick a day and time." : "Walk-in, phone booking, or a regular booking again."}
          </p>
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <AppointmentForm
              businessId={user.id}
              trade={profile.trade}
              pricingConfig={pricingConfig}
              staffNames={profile.staff_names ?? []}
              initialClient={clientForForm}
              initialAnswers={previousAnswers}
              initialDate={/^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "") ? searchParams.date : undefined}
              initialTime={/^([01]\d|2[0-3]):[0-5]\d$/.test(searchParams.time ?? "") ? searchParams.time : undefined}
            />
          </div>
        </div>
      </main>
    );
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
