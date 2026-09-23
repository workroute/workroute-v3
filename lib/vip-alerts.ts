// §34a — replaces the technically-unworkable "live VIP call bypass" from
// §5.1's original description (unconditional call forwarding means a
// transfer back to the tradie's own number just loops). Instead: the AI
// answers every call as normal, but a pre-registered number gets the tradie
// an instant SMS heads-up in parallel, via the existing Mobile Message
// system (§13).

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "./mobile-message";
import { normalizePhone } from "./phone-utils";

// supabase must be the service-role client — this runs from the Vapi
// webhook, which has no authenticated tradie session (see
// app/api/vapi/webhook/route.ts).
export async function checkAndAlertVip(
  supabase: SupabaseClient,
  businessId: string,
  callerNumber: string | null | undefined
): Promise<void> {
  if (!callerNumber) return;

  const { data: match } = await supabase
    .from("vip_contacts")
    .select("name")
    .eq("business_id", businessId)
    .eq("phone_normalized", normalizePhone(callerNumber))
    .maybeSingle();

  if (!match) return;

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("phone")
    .eq("user_id", businessId)
    .maybeSingle();

  if (!profile?.phone) return;

  // Fire-and-forget from the caller's point of view — must never delay or
  // block the AI picking up the call, so failures here are swallowed
  // (already the contract sendSms returns, not thrown).
  await sendSms(profile.phone, `${match.name} is calling — you might want to call them back.`);
}
