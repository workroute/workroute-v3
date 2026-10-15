import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyAdmin } from "./push-notifications";
import { brisbaneMonth } from "./fair-use";

// §sales-line-limits — WorkRoute's own demo phone line is public (it's the
// "Hear Sarah" number on the website), and every call costs real money while
// bringing in none directly. Placeholders; change any of these here.

// One caller can ring this many times in 24 hours, then Sarah politely ends
// the call. Prevents someone (or a bot) running up costs by redialling.
export const SALES_LINE_MAX_CALLS_PER_CALLER_PER_DAY = 3;
// Hard stop on a single call. A demo needs three or four minutes.
export const SALES_LINE_MAX_CALL_SECONDS = 300;
// Calls in a month before the owner gets a heads-up (the line keeps working).
export const SALES_LINE_MONTHLY_ALERT_CALLS = 60;

// The owner's own mobile is never limited, so testing never locks him out.
const EXEMPT_NUMBERS = ["61421992122"];

function normaliseNumber(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.startsWith("0") ? `61${digits.slice(1)}` : digits;
}

// True when this caller has already rung the line the maximum number of times
// in the last 24 hours. Never throws: if anything goes wrong the call is let through.
export async function isSalesCallerLimited(supabase: SupabaseClient, callerNumber: string | null): Promise<boolean> {
  try {
    const normalised = normaliseNumber(callerNumber);
    if (!normalised || EXEMPT_NUMBERS.includes(normalised)) return false;

    const { count } = await supabase
      .from("sales_line_calls")
      .select("*", { count: "exact", head: true })
      .eq("caller_number", normalised)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    return (count ?? 0) >= SALES_LINE_MAX_CALLS_PER_CALLER_PER_DAY;
  } catch (error) {
    console.error("[sales-line] caller check failed —", error);
    return false;
  }
}

export async function recordSalesLineCall(
  supabase: SupabaseClient,
  vapiCallId: string,
  callerNumber: string | null
): Promise<void> {
  try {
    await supabase
      .from("sales_line_calls")
      .upsert(
        { vapi_call_id: vapiCallId, caller_number: normaliseNumber(callerNumber) || null },
        { onConflict: "vapi_call_id", ignoreDuplicates: true }
      );
  } catch (error) {
    console.error("[sales-line] couldn't record call —", error);
  }
}

// At the end of a call: save its length and cost, then warn the owner (once a
// month) if the demo line has had a lot of calls. Never throws.
export async function finishSalesLineCall(
  supabase: SupabaseClient,
  message: any,
  appOrigin: string
): Promise<void> {
  try {
    const vapiCallId: string | undefined = message.call?.id;
    if (!vapiCallId) return;

    const costBreakdown = message.costBreakdown ?? message.call?.costBreakdown ?? null;
    const startedAt = message.startedAt ?? message.call?.startedAt;
    const endedAt = message.endedAt ?? message.call?.endedAt;
    const seconds =
      typeof message.durationSeconds === "number"
        ? message.durationSeconds
        : startedAt && endedAt
          ? (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
          : null;
    const cost = message.cost ?? message.call?.cost ?? costBreakdown?.total ?? null;

    if (seconds != null && cost != null) {
      await supabase
        .from("sales_line_calls")
        .update({
          duration_seconds: Math.round(seconds),
          vapi_cost_usd: Number(cost),
          tts_characters: Math.round(costBreakdown?.ttsCharacters ?? 0),
        })
        .eq("vapi_call_id", vapiCallId);
    }

    const adminId = process.env.ADMIN_USER_ID;
    if (!adminId) return;
    const { key, startIso } = brisbaneMonth();
    const { count } = await supabase
      .from("sales_line_calls")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startIso);
    if ((count ?? 0) < SALES_LINE_MONTHLY_ALERT_CALLS) return;

    const { data: owner } = await supabase
      .from("business_profiles")
      .select("demo_line_alerted_month")
      .eq("user_id", adminId)
      .maybeSingle();
    if (!owner || owner.demo_line_alerted_month === key) return;

    await supabase.from("business_profiles").update({ demo_line_alerted_month: key }).eq("user_id", adminId);
    await notifyAdmin(
      supabase,
      "Demo line is busy",
      `The WorkRoute demo line has had ${count} calls this month. It's still answering. Check what it's costing you on Owner Overview.`,
      appOrigin
    );
  } catch (error) {
    console.error("[sales-line] end-of-call tracking failed —", error);
  }
}
