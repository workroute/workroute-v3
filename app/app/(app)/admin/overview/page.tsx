import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MarkPayingButton from "./mark-paying-button";

const TRIAL_DAYS = 14;
const TRIAL_CALL_CAP = 150;

// §owner-overview — cross-business visibility for the owner only (same
// ADMIN_USER_ID gate as the phone-number provisioning tool in Settings >
// Phone AI). Every other page in this app is scoped to the signed-in
// business's own data — this is deliberately the one exception, since the
// owner needs to see how every tradie's account is actually doing without
// querying the database directly. 404s (not a redirect) for anyone else,
// so its existence isn't hinted at either.
export default async function OwnerOverviewPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (user.id !== process.env.ADMIN_USER_ID) {
    notFound();
  }

  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id, business_name, trade, first_name, created_at, vapi_phone_number, starting_price, is_paying")
    .order("created_at", { ascending: true });

  const businessIds = (businesses ?? []).map((b) => b.user_id);

  const [{ data: allJobs }, { data: pricingConfigs }, { data: allCalls }] = await Promise.all([
    businessIds.length
      ? supabase
          .from("jobs")
          .select("business_id, created_at, attention_priority")
          .in("business_id", businessIds)
      : Promise.resolve({ data: [] }),
    businessIds.length
      ? supabase.from("trade_pricing_configs").select("business_id").in("business_id", businessIds)
      : Promise.resolve({ data: [] }),
    businessIds.length
      ? supabase
          .from("phone_call_captures")
          .select("business_id, created_at")
          .in("business_id", businessIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const weekAgo = Date.now() - 7 * 86400000;
  const pricingSet = new Set((pricingConfigs ?? []).map((p) => p.business_id));

  const stats = (businesses ?? []).map((b) => {
    const jobs = (allJobs ?? []).filter((j) => j.business_id === b.user_id);
    const calls = (allCalls ?? []).filter((c) => c.business_id === b.user_id);
    const jobsThisWeek = jobs.filter((j) => new Date(j.created_at).getTime() > weekAgo).length;
    const needsAttention = jobs.filter((j) => j.attention_priority !== null).length;
    const lastActivity = [jobs[0]?.created_at, calls[0]?.created_at].filter(Boolean).sort().reverse()[0] ?? null;

    // §trial-limits — same 14-day/150-call rule enforced live in
    // app/api/vapi/webhook/route.ts's handleAssistantRequest, recomputed
    // here just for display.
    const daysSinceSignup = (Date.now() - new Date(b.created_at).getTime()) / 86400000;
    const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - daysSinceSignup));
    const trialStatus = b.is_paying
      ? { label: "Paying", tone: "moss" as const }
      : calls.length >= TRIAL_CALL_CAP
        ? { label: "Trial — call limit reached", tone: "rust" as const }
        : daysSinceSignup > TRIAL_DAYS
          ? { label: "Trial — expired", tone: "rust" as const }
          : { label: `Trial — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, tone: "amber" as const };

    return {
      ...b,
      totalJobs: jobs.length,
      totalCalls: calls.length,
      jobsThisWeek,
      needsAttention,
      hasPricing: pricingSet.has(b.user_id) || !!b.starting_price,
      lastActivity,
      trialStatus,
    };
  });

  return (
    <main className="min-h-screen bg-paper-50 pb-16 md:pb-0">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/app/settings" className="text-sm font-medium text-steel-500 hover:underline">
          ← Settings
        </Link>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-amber-600">Owner only</p>
        <h1 className="font-display text-2xl font-bold text-rig-900">Every business, at a glance</h1>
        <p className="mt-1 text-sm text-rig-700">
          {stats.length} business{stats.length === 1 ? "" : "es"} on WorkRoute.
        </p>

        <div className="mt-6 space-y-3">
          {stats.length === 0 ? (
            <p className="rounded-lg border border-rig-900/10 bg-white p-6 text-center text-sm text-rig-700/60 shadow-sm">
              No businesses signed up yet.
            </p>
          ) : (
            stats.map((b) => (
              <div key={b.user_id} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display font-semibold text-rig-900">{b.business_name}</p>
                    <p className="text-xs text-rig-700/70">
                      {b.trade} · {b.first_name ?? "no name"} · signed up{" "}
                      {new Date(b.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-1 font-medium ${
                        b.trialStatus.tone === "moss"
                          ? "bg-moss-500/10 text-moss-500"
                          : b.trialStatus.tone === "rust"
                            ? "bg-rust-500/10 text-rust-500"
                            : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {b.trialStatus.label}
                    </span>
                    {!b.is_paying && <MarkPayingButton businessId={b.user_id} />}
                    <span
                      className={`rounded-full px-2.5 py-1 font-medium ${
                        b.vapi_phone_number ? "bg-moss-500/10 text-moss-500" : "bg-rig-700/10 text-rig-700"
                      }`}
                    >
                      {b.vapi_phone_number ? "Number connected" : "No number yet"}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 font-medium ${
                        b.hasPricing ? "bg-moss-500/10 text-moss-500" : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {b.hasPricing ? "Pricing set" : "No pricing yet"}
                    </span>
                    {b.needsAttention > 0 && (
                      <span className="rounded-full bg-rust-500/10 px-2.5 py-1 font-medium text-rust-500">
                        {b.needsAttention} needs attention
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-rig-900/5 pt-3 text-sm text-rig-700">
                  <span>
                    <b className="text-rig-900">{b.totalJobs}</b> total jobs
                  </span>
                  <span>
                    <b className="text-rig-900">{b.jobsThisWeek}</b> this week
                  </span>
                  <span>
                    <b className="text-rig-900">{b.totalCalls}</b> calls total
                  </span>
                  <span>
                    Last activity:{" "}
                    <b className="text-rig-900">
                      {b.lastActivity
                        ? new Date(b.lastActivity).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
                        : "never"}
                    </b>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
