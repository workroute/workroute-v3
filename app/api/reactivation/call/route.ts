import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { placeOutboundReactivationCall } from "@/lib/reactivation";

// §38 — session-authed (a real tradie clicking "Call now"), not the
// x-vapi-secret/CRON_SECRET pattern used elsewhere in this feature's
// siblings — this route is only ever hit from the reactivation-calling
// settings page.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { clientId } = await request.json();
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase
      .from("business_profiles")
      .select("business_name, trade, first_name, vapi_phone_number_id, service_area, ai_voice_id, ai_persona_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    // RLS already scopes this to clients belonging to the caller's own
    // business — no separate ownership check needed beyond the query itself.
    supabase
      .from("clients")
      .select("id, name, phone, address_street, address_suburb, do_not_call")
      .eq("id", clientId)
      .eq("business_id", user.id)
      .maybeSingle(),
  ]);

  if (!profile?.vapi_phone_number_id) {
    return NextResponse.json({ error: "No Vapi phone number connected — set one up in Settings > Phone AI first." }, { status: 400 });
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.phone) {
    return NextResponse.json({ error: "This client has no phone number on file" }, { status: 400 });
  }

  if (client.do_not_call) {
    return NextResponse.json({ error: "This client is marked do-not-call" }, { status: 400 });
  }

  const result = await placeOutboundReactivationCall(
    supabase,
    {
      businessId: user.id,
      businessName: profile.business_name,
      trade: profile.trade,
      firstName: profile.first_name,
      serviceArea: profile.service_area,
      voiceId: profile.ai_voice_id,
      personaName: profile.ai_persona_name,
      vapiPhoneNumberId: profile.vapi_phone_number_id,
    },
    {
      id: client.id,
      name: client.name,
      phone: client.phone,
      addressStreet: client.address_street,
      addressSuburb: client.address_suburb,
    }
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
