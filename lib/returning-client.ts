// §25 revision — a caller whose number matches an existing client record
// gets a fast-path: the AI greets them by name and can book them straight
// in without re-running full intake. See systemPrompt in lib/phone-ai.ts
// for how this context actually changes the conversation.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "./phone-utils";

export type MatchedClient = {
  id: string;
  name: string;
  addressStreet: string | null;
  addressSuburb: string | null;
  addressPostcode: string | null;
};

// clients.phone is free text (no normalized column, unlike vip_contacts) —
// a solo tradie's client list is small enough that fetching and comparing
// in application code is simpler than a schema change just for this.
export async function findMatchingClient(
  supabase: SupabaseClient,
  businessId: string,
  callerNumber: string | null | undefined
): Promise<MatchedClient | null> {
  if (!callerNumber) return null;

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, phone, address_street, address_suburb, address_postcode")
    .eq("business_id", businessId)
    .not("phone", "is", null);

  const target = normalizePhone(callerNumber);
  const match = (clients ?? []).find((c) => c.phone && normalizePhone(c.phone) === target);
  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    addressStreet: match.address_street,
    addressSuburb: match.address_suburb,
    addressPostcode: match.address_postcode,
  };
}
