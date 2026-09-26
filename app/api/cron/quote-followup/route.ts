import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getQuoteJobsDueForCall, placeOutboundQuoteFollowupCall } from "@/lib/quote-followup";

// §quote-followup — runs twice a day (see vercel.json: ~9am and ~2pm
// Brisbane) rather than invoice-chase's once-daily cadence, since a quote
// given in the morning needs a same-afternoon call and one given in the
// afternoon needs a next-morning call — see lib/quote-followup.ts for the
// exact timing rule. Skipped for any business with no connected Vapi number.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id, business_name, trade, first_name, service_area, vapi_phone_number_id, ai_voice_id, ai_persona_name");

  let callsPlaced = 0;

  for (const business of businesses ?? []) {
    if (!business.vapi_phone_number_id) continue;

    const dueJobs = await getQuoteJobsDueForCall(supabase, business.user_id);

    for (const job of dueJobs) {
      const result = await placeOutboundQuoteFollowupCall(
        supabase,
        {
          businessId: business.user_id,
          businessName: business.business_name,
          trade: business.trade,
          firstName: business.first_name,
          serviceArea: business.service_area,
          voiceId: business.ai_voice_id,
          personaName: business.ai_persona_name,
          startingPrice: null,
          vapiPhoneNumberId: business.vapi_phone_number_id,
        },
        job
      );

      if (result.ok) callsPlaced++;
    }
  }

  return NextResponse.json({ ok: true, callsPlaced });
}
