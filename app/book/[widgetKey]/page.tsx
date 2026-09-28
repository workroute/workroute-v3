import { createServiceRoleClient } from "@/lib/supabase/service-role";
import BookingForm from "./booking-form";

// §public-booking-page — deliberately public, no auth. widget_key is the
// same public identifier the embeddable website chat widget already uses
// (see app/api/widget/[widgetKey]/route.ts's own header comment on why
// that's safe to expose) — a shareable link a tradie can put on their
// business card, socials, or their own website, so a customer can book a
// real free slot themselves without calling or chatting first.
export default async function BookPage({ params }: { params: { widgetKey: string } }) {
  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("business_name, trade, service_area")
    .eq("widget_key", params.widgetKey)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper-50 px-4">
        <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="font-display font-semibold text-rig-900">Link not found</p>
          <p className="mt-2 text-sm text-rig-700">
            This booking link may be out of date. Please contact the business directly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen justify-center bg-paper-50 sm:items-center sm:p-6">
      <div className="flex w-full max-w-md flex-col bg-white sm:overflow-hidden sm:rounded-lg sm:shadow-lg">
        <header className="border-b border-rig-900/10 bg-rig-900 px-4 py-4 sm:rounded-t-lg">
          <p className="font-display text-lg font-semibold text-paper-50">{profile.business_name}</p>
          <p className="text-xs text-paper-50/70">
            {profile.trade}
            {profile.service_area ? ` — servicing ${profile.service_area}` : ""}
          </p>
        </header>
        <div className="p-4">
          <BookingForm widgetKey={params.widgetKey} />
        </div>
      </div>
    </main>
  );
}
