import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSeriesDueForRenewalPrompt, markRenewalPrompted } from "@/lib/recurring-jobs";
import { sendSms } from "@/lib/mobile-message";
import { messageFor } from "@/lib/notifications";

// §Recurring renewal — a "Regular" series only pre-books 5 visits up front
// (see lib/recurring-jobs.ts). This runs once a day, finds any series whose
// last booked visit is coming up within DAYS_AHEAD, and texts the customer a
// Messenger link asking if they want their next 5 visits booked in. The
// customer's reply is handled by lib/messenger-ai.ts's confirm_recurring_renewal
// tool — this route only ever sends the initial invite, never awaits a reply.
const DAYS_AHEAD = 7;

function formatDateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Brisbane",
  }).format(new Date(`${dateStr}T00:00:00`));
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const appOrigin = new URL(request.url).origin;

  const { data: businesses } = await supabase.from("business_profiles").select("user_id, business_name, first_name");

  let sent = 0;

  for (const business of businesses ?? []) {
    const candidates = await getSeriesDueForRenewalPrompt(supabase, business.user_id, DAYS_AHEAD);

    for (const candidate of candidates) {
      const messengerLink = `${appOrigin}/m/${candidate.customerAccessToken}`;
      const message = messageFor(
        "recurring_renewal",
        candidate.customerName,
        business.first_name,
        business.business_name,
        messengerLink,
        null,
        formatDateLabel(candidate.scheduledDate)
      );

      const result = await sendSms(candidate.customerPhone, message);
      if (result.ok) {
        await markRenewalPrompted(supabase, candidate.jobId);
        sent++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
