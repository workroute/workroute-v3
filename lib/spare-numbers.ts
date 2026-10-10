import type { SupabaseClient } from "@supabase/supabase-js";

// §spare-numbers — numbers already bought and wired to Vapi, waiting for a
// business. Callers pass a service-role client: the table has no RLS policies.

// A released number rests this long before it can go to someone else, so
// people still ringing the old business don't reach the new one.
export const NUMBER_REST_DAYS = 30;

export async function countAvailableSpares(admin: SupabaseClient): Promise<number> {
  const { count } = await admin
    .from("spare_phone_numbers")
    .select("*", { count: "exact", head: true })
    .eq("status", "spare")
    .lte("available_after", new Date().toISOString());
  return count ?? 0;
}

// Gives the business the oldest available spare. Returns the number, or null
// if there's no spare in stock (or the business already has a number).
export async function assignSpareNumber(admin: SupabaseClient, businessId: string): Promise<string | null> {
  const { data: profile } = await admin
    .from("business_profiles")
    .select("vapi_phone_number_id")
    .eq("user_id", businessId)
    .maybeSingle();
  if (!profile || profile.vapi_phone_number_id) return null;

  const { data: candidates } = await admin
    .from("spare_phone_numbers")
    .select("id, number, vapi_phone_number_id, didlogic_did_id")
    .eq("status", "spare")
    .lte("available_after", new Date().toISOString())
    .order("available_after", { ascending: true })
    .limit(5);

  for (const spare of candidates ?? []) {
    // Claim it first. The status check means two sign-ups at once can't
    // both get the same number.
    const { data: claimed } = await admin
      .from("spare_phone_numbers")
      .update({ status: "assigned", assigned_business_id: businessId })
      .eq("id", spare.id)
      .eq("status", "spare")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const { error } = await admin
      .from("business_profiles")
      .update({
        vapi_phone_number_id: spare.vapi_phone_number_id,
        vapi_phone_number: spare.number,
        didlogic_did_id: spare.didlogic_did_id,
      })
      .eq("user_id", businessId);

    if (error) {
      await admin
        .from("spare_phone_numbers")
        .update({ status: "spare", assigned_business_id: null })
        .eq("id", spare.id);
      return null;
    }
    return spare.number;
  }
  return null;
}

// Takes the number off the business and puts it back in stock, resting for
// NUMBER_REST_DAYS. A number that was bought directly for a business (before
// the spare list existed) is added to the list the first time it's released.
export async function releaseNumber(admin: SupabaseClient, businessId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: profile } = await admin
    .from("business_profiles")
    .select("vapi_phone_number_id, vapi_phone_number, didlogic_did_id")
    .eq("user_id", businessId)
    .maybeSingle();
  if (!profile?.vapi_phone_number_id) return { ok: false, error: "That business has no number to release." };

  const availableAfter = new Date(Date.now() + NUMBER_REST_DAYS * 86400000).toISOString();

  const { error: spareError } = await admin.from("spare_phone_numbers").upsert(
    {
      number: profile.vapi_phone_number ?? "",
      vapi_phone_number_id: profile.vapi_phone_number_id,
      didlogic_did_id: profile.didlogic_did_id,
      status: "spare",
      available_after: availableAfter,
      assigned_business_id: null,
    },
    { onConflict: "vapi_phone_number_id" }
  );
  if (spareError) return { ok: false, error: spareError.message };

  const { error } = await admin
    .from("business_profiles")
    .update({ vapi_phone_number_id: null, vapi_phone_number: null, didlogic_did_id: null })
    .eq("user_id", businessId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
