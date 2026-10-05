import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatAppointmentLabel } from "@/lib/notifications";
import SlotActions from "./slot-actions";

// Deliberately public, no login. This is the page behind the "a spot opened
// up, want to move up?" text (lib/gap-fill.ts). The token in the URL is a
// long random string only that client was sent.
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen justify-center bg-paper-50 sm:items-center sm:p-6">
      <div className="flex w-full max-w-md flex-col bg-white sm:overflow-hidden sm:rounded-lg sm:shadow-lg">{children}</div>
    </main>
  );
}

function Message({ business, title, body }: { business?: string; title: string; body: string }) {
  return (
    <Shell>
      {business && (
        <header className="border-b border-rig-900/10 bg-rig-900 px-4 py-4">
          <p className="font-display text-lg font-semibold text-paper-50">{business}</p>
        </header>
      )}
      <div className="p-6 text-center">
        <p className="font-display text-lg font-semibold text-rig-900">{title}</p>
        <p className="mt-2 text-sm text-rig-700">{body}</p>
      </div>
    </Shell>
  );
}

export default async function SlotPage({ params }: { params: { token: string } }) {
  if (!/^[0-9a-f]{64}$/.test(params.token)) {
    return <Message title="Link not found" body="This link may be out of date. Please contact the business directly." />;
  }

  const supabase = createServiceRoleClient();
  const { data: offer } = await supabase
    .from("slot_offers")
    .select("id, business_id, job_id, slot_date, slot_time, status, expires_at")
    .eq("token", params.token)
    .maybeSingle();
  if (!offer) {
    return <Message title="Link not found" body="This link may be out of date. Please contact the business directly." />;
  }

  const [{ data: business }, { data: job }] = await Promise.all([
    supabase.from("business_profiles").select("business_name").eq("user_id", offer.business_id).maybeSingle(),
    supabase
      .from("jobs")
      .select("customer_name, status, scheduled_date, scheduled_time")
      .eq("id", offer.job_id)
      .maybeSingle(),
  ]);
  const businessName = business?.business_name ?? "Your appointment";
  const newLabel = formatAppointmentLabel(offer.slot_date, offer.slot_time.slice(0, 5), null);

  if (offer.status === "claimed") {
    return <Message business={businessName} title="You're booked in" body={`Your appointment is ${newLabel}. See you then!`} />;
  }
  const expired = new Date(offer.expires_at).getTime() < Date.now();
  if (offer.status !== "offered" || expired) {
    return (
      <Message
        business={businessName}
        title="That spot has gone"
        body="Someone else took it, or it's too close to the time now. Your original appointment hasn't changed."
      />
    );
  }
  if (!job || job.status !== "Scheduled" || !job.scheduled_date || !job.scheduled_time) {
    return <Message business={businessName} title="Nothing to move" body="We couldn't find your upcoming appointment. Please contact us directly." />;
  }

  const oldLabel = formatAppointmentLabel(job.scheduled_date, job.scheduled_time.slice(0, 5), null);
  const firstName = (job.customer_name ?? "").trim().split(/\s+/)[0];

  return (
    <Shell>
      <header className="border-b border-rig-900/10 bg-rig-900 px-4 py-4">
        <p className="font-display text-lg font-semibold text-paper-50">{businessName}</p>
        <p className="text-xs text-paper-50/70">A spot just opened up</p>
      </header>
      <div className="p-5">
        <p className="text-sm text-rig-700">{firstName ? `Hi ${firstName}, w` : "W"}ould you like to move up to an earlier time?</p>
        <div className="mt-4 space-y-2 rounded-lg bg-paper-100 p-4 text-sm">
          <p className="text-rig-700">
            Your appointment now: <b className="text-rig-900">{oldLabel}</b>
          </p>
          <p className="text-rig-700">
            Earlier time on offer: <b className="text-rig-900">{newLabel}</b>
          </p>
        </div>
        <SlotActions token={params.token} />
      </div>
    </Shell>
  );
}
