import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOnboardingReminderEmail } from "@/lib/resend";
import { loadTradePricingConfig } from "@/lib/trade-pricing";

// §staged-onboarding — a one-time nudge for anyone who finished the Quick
// Start screen (app/app/welcome) but never came back to set up pricing.
// Same shape as weather-check's cron (CRON_SECRET bearer check, service
// role client), and the same "guard column set right after sending"
// idempotency pattern welcome_emails_sent already uses for the welcome
// email — a column here rather than a table, since this only ever needs
// to fire once per business, not something that grows into a log.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const cutoff = new Date(Date.now() - 2 * 86400000).toISOString();

  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id, first_name, trade, starting_price, created_at")
    .lt("created_at", cutoff)
    .is("onboarding_reminder_sent_at", null);

  let sent = 0;

  for (const business of businesses ?? []) {
    if (business.starting_price) continue; // has a fallback price — not stuck

    const pricingConfig = await loadTradePricingConfig(supabase, business.user_id, business.trade);
    if (pricingConfig) continue; // real pricing already configured

    const { data: authUser } = await supabase.auth.admin.getUserById(business.user_id);
    const email = authUser?.user?.email;
    if (!email) continue;

    const result = await sendOnboardingReminderEmail(email, business.first_name);
    // Set the guard regardless of send success — this is a one-time nudge,
    // not a retry queue; a transient email failure shouldn't mean this
    // business gets re-emailed indefinitely on every future cron run.
    await supabase
      .from("business_profiles")
      .update({ onboarding_reminder_sent_at: new Date().toISOString() })
      .eq("user_id", business.user_id);

    if (result.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
