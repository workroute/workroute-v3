import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyTradieFairUse, notifyAdminFairUse } from "./push-notifications";
import { FAIR_USE_CALLS_PER_MONTH, FAIR_USE_WARNING_AT } from "./fair-use-config";

// §fair-usage — at the warning point the tradie gets a friendly heads-up and
// the owner gets a push; at the limit both are told again, and the owner
// follows up to talk about a plan that suits. The two numbers live in
// lib/fair-use-config.ts.

// Calendar months in Brisbane time (no daylight saving, UTC+10), matching the
// rest of the app.
const BRISBANE_OFFSET_MS = 10 * 3600 * 1000;

export function brisbaneMonth(now: Date = new Date()): { key: string; startIso: string } {
  const local = new Date(now.getTime() + BRISBANE_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    startIso: new Date(Date.UTC(year, month, 1) - BRISBANE_OFFSET_MS).toISOString(),
  };
}

// Run after each call finishes (not while the caller is waiting, so it can't
// slow a call down). Only paying businesses are checked: the free trial has
// its own limit. Each message goes out once per month. Never throws, so it
// can't disturb the end-of-call work around it.
export async function checkFairUse(supabase: SupabaseClient, businessId: string, appOrigin: string): Promise<void> {
  try {
    if (businessId === process.env.ADMIN_USER_ID) return;

    const { data: profile } = await supabase
      .from("business_profiles")
      .select("business_name, is_paying, fair_use_warned_month, fair_use_limit_month")
      .eq("user_id", businessId)
      .maybeSingle();
    if (!profile?.is_paying) return;

    const { key, startIso } = brisbaneMonth();
    const { count } = await supabase
      .from("phone_call_captures")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("call_purpose", "inbound")
      .gte("created_at", startIso);
    const used = count ?? 0;

    const limit = FAIR_USE_CALLS_PER_MONTH;
    const warnAt = Math.ceil(limit * FAIR_USE_WARNING_AT);

    if (used >= limit && profile.fair_use_limit_month !== key) {
      await supabase
        .from("business_profiles")
        .update({ fair_use_limit_month: key, fair_use_warned_month: key })
        .eq("user_id", businessId);
      await notifyTradieFairUse(supabase, businessId, used, limit, appOrigin, true);
      await notifyAdminFairUse(supabase, profile.business_name, used, limit, appOrigin, true);
    } else if (used >= warnAt && used < limit && profile.fair_use_warned_month !== key) {
      await supabase.from("business_profiles").update({ fair_use_warned_month: key }).eq("user_id", businessId);
      await notifyTradieFairUse(supabase, businessId, used, limit, appOrigin, false);
      await notifyAdminFairUse(supabase, profile.business_name, used, limit, appOrigin, false);
    }
  } catch (error) {
    console.error("[fair-use] check failed —", error);
  }
}
