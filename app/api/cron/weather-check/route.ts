import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getForecastSummary } from "@/lib/weather";
import { notifyOwnerDailyBriefing } from "@/lib/push-notifications";

// §44 — daily 3pm (Brisbane) briefing: tomorrow's jobs + real weather, sent
// every day regardless of forecast, so the tradie can actually decide
// whether tomorrow's jobs can go ahead. Wired to run automatically via the
// vercel.json crons block (schedule is in UTC — see that file's comment for
// the conversion). Runs once per business per day (debounced on
// last_weather_warning_date) so a duplicate/retried cron invocation can't
// double-notify.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const appOrigin = new URL(request.url).origin;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id, city, last_weather_warning_date");

  let sent = 0;

  for (const business of businesses ?? []) {
    if (business.last_weather_warning_date === today) continue; // debounce

    const { data: jobs } = await supabase
      .from("jobs")
      .select("customer_name, job_label")
      .eq("business_id", business.user_id)
      .neq("status", "Completed")
      .eq("scheduled_date", tomorrow);

    const jobCount = jobs?.length ?? 0;
    const jobSummary = (jobs ?? [])
      .slice(0, 3)
      .map((j) => j.job_label || j.customer_name)
      .join(", ");
    const jobSummaryText =
      jobCount > 3 ? `${jobSummary} + ${jobCount - 3} more (${jobCount} jobs)` : `${jobSummary} (${jobCount} job${jobCount === 1 ? "" : "s"})`;

    const weatherSummary = business.city?.trim() ? await getForecastSummary(business.city, tomorrow) : null;

    // Nothing worth telling them about — no jobs tomorrow and no weather
    // data available at all — skip rather than sending an empty briefing.
    if (jobCount === 0 && !weatherSummary) continue;

    await notifyOwnerDailyBriefing(
      supabase,
      business.user_id,
      jobCount,
      jobSummaryText,
      weatherSummary,
      appOrigin
    );
    await supabase
      .from("business_profiles")
      .update({ last_weather_warning_date: today })
      .eq("user_id", business.user_id);
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
