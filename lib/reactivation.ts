// §38 — Sarah outbound reactivation calling: find clients who haven't had a
// completed job in a while, and place an outbound Vapi call offering to
// book them in again. See lib/phone-ai.ts for the outbound assistant
// config/prompt/tools, and app/api/vapi/webhook/route.ts for how the call
// itself is handled once it's ringing — this file is just the lapsed-client
// query and the "start a call" step.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PhoneBusinessContext } from "./phone-ai";
import { buildOutboundAssistantConfig } from "./phone-ai";
import { createServiceRoleClient } from "./supabase/service-role";

export type LapsedClient = {
  id: string;
  name: string;
  phone: string;
  addressStreet: string | null;
  addressSuburb: string | null;
  addressPostcode: string | null;
  lastJobDate: string;
  lastReactivationCallAt: string | null;
};

// Only counts clients with at least one *completed* job — someone with zero
// completed jobs was never a customer, so "lapsed" doesn't apply to them.
// Deliberately does NOT hide clients already called recently; this feature
// is manual-review-and-trigger by design (see 0017_reactivation_calling.sql),
// so the tradie sees last_reactivation_call_at and decides for themselves
// rather than the query silently debouncing on their behalf.
export async function getLapsedClients(
  supabase: SupabaseClient,
  businessId: string,
  lapsedMonths: number
): Promise<LapsedClient[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - lapsedMonths);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  // Two plain queries rather than a PostgREST embedded-relationship select —
  // client_last_completed_job is a view with no foreign key to clients, so
  // PostgREST has no relationship metadata to embed it automatically. The
  // view's own RLS (security_invoker, see 0017_reactivation_calling.sql)
  // already scopes this to jobs this business owns.
  const { data: lapsedJobs } = await supabase
    .from("client_last_completed_job")
    .select("client_id, last_job_date")
    .lt("last_job_date", cutoffDate);

  if (!lapsedJobs || lapsedJobs.length === 0) return [];

  const lastJobDateByClient = new Map(lapsedJobs.map((r) => [r.client_id as string, r.last_job_date as string]));

  // Small-list "join in application code" is the established pattern here —
  // see lib/returning-client.ts's own comment on why (a solo tradie's client
  // list is small enough that this is simpler than a schema change).
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, phone, address_street, address_suburb, address_postcode, last_reactivation_call_at")
    .eq("business_id", businessId)
    .eq("do_not_call", false)
    .not("phone", "is", null)
    .in("id", [...lastJobDateByClient.keys()]);

  return (clients ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone as string,
      addressStreet: c.address_street,
      addressSuburb: c.address_suburb,
      addressPostcode: c.address_postcode,
      lastJobDate: lastJobDateByClient.get(c.id)!,
      lastReactivationCallAt: c.last_reactivation_call_at,
    }))
    .sort((a, b) => a.lastJobDate.localeCompare(b.lastJobDate));
}

// §51 — Vapi requires international format (+61...) for outbound calls;
// every phone number in this app is entered/stored the normal local AU way
// (04xx xxx xxx), same as SMS (Mobile Message accepts that format natively,
// which is why this was never noticed there). Converts local AU numbers to
// E.164 automatically so nobody ever has to type "+61" themselves — already-
// international numbers pass through untouched.
export function toE164Au(phone: string): string {
  const hadPlus = phone.trim().startsWith("+");
  const digits = phone.replace(/\D/g, "");
  if (hadPlus) return `+${digits}`;
  // Already has the country code but no "+" (e.g. "61421992122") — an AU
  // mobile/landline is 9 digits after the 61, so 11 digits total here.
  if (digits.startsWith("61") && digits.length === 11) return `+${digits}`;
  return `+61${digits.replace(/^0/, "")}`;
}

// Places the actual outbound call via Vapi's REST API
// (POST https://api.vapi.ai/call — verified against docs.vapi.ai, not yet
// live-tested against a real call, unlike the rest of tonight's work: this
// one places a real phone call, so test it deliberately, ideally to your
// own number first, rather than trusting it blind).
export async function placeOutboundReactivationCall(
  supabase: SupabaseClient,
  business: PhoneBusinessContext & { vapiPhoneNumberId: string },
  client: Pick<LapsedClient, "id" | "name" | "phone" | "addressStreet" | "addressSuburb">
): Promise<{ ok: true; vapiCallId: string } | { ok: false; error: string }> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "VAPI_API_KEY is not configured." };
  }

  const assistant = buildOutboundAssistantConfig(business, client);

  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistant,
      phoneNumberId: business.vapiPhoneNumberId,
      customer: { number: toE164Au(client.phone) },
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.id) {
    return { ok: false, error: body?.message ?? `Vapi call request failed (${res.status}).` };
  }

  const vapiCallId: string = body.id;

  // phone_call_captures is select-only for authenticated sessions (see
  // 0014_phone_ai.sql) — writing to it always needs the service-role
  // client, regardless of whether `supabase` above is session- or
  // service-role-scoped. Same shape as the inbound assistant-request upsert
  // in the webhook route, except matched_client_id and call_purpose are
  // known upfront here — an outbound call always knows exactly who it's
  // calling before it starts.
  await createServiceRoleClient().from("phone_call_captures").insert({
    business_id: business.businessId,
    vapi_call_id: vapiCallId,
    caller_number: client.phone,
    matched_client_id: client.id,
    call_purpose: "reactivation",
  });

  await supabase.from("clients").update({ last_reactivation_call_at: new Date().toISOString() }).eq("id", client.id);

  return { ok: true, vapiCallId };
}
