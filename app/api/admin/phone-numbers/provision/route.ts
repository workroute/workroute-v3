import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getDidlogicBalance,
  purchaseDidlogicNumber,
  createDidlogicSipAccount,
  routeDidlogicNumberToSipAccount,
} from "@/lib/didlogic";
import { createVapiSipTrunkCredential, createVapiPhoneNumber } from "@/lib/vapi-admin";

// §admin-number-provisioning — the full sequence, run in order, stopping
// and reporting the exact failed step rather than continuing past a
// partial failure. Every DIDLogic/Vapi resource created here is BRAND NEW
// for this one tradie — never a shared or reused credential/SIP account.
// See lib/didlogic.ts and lib/vapi-admin.ts for the individual calls this
// orchestrates, and the plan doc for the full "why" behind each step.
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const businessUserId = body?.businessUserId;
  const didId = body?.didId;
  const didNumber = body?.didNumber;
  const monthlyFee = typeof body?.monthlyFee === "number" ? body.monthlyFee : null;

  if (typeof businessUserId !== "string" || typeof didId !== "number" || typeof didNumber !== "string") {
    return NextResponse.json({ ok: false, error: "Missing businessUserId/didId/didNumber." }, { status: 400 });
  }

  const serviceRole = createServiceRoleClient();

  const { data: targetBusiness } = await serviceRole
    .from("business_profiles")
    .select("business_name")
    .eq("user_id", businessUserId)
    .maybeSingle();

  if (!targetBusiness) {
    return NextResponse.json({ ok: false, error: "That business account doesn't exist." }, { status: 404 });
  }

  let step = "balance check";
  try {
    if (monthlyFee !== null) {
      const balance = await getDidlogicBalance();
      if (balance !== null && balance < monthlyFee) {
        return NextResponse.json(
          {
            ok: false,
            step,
            error: `DIDLogic balance ($${balance.toFixed(2)}) is below this number's monthly cost ($${monthlyFee.toFixed(2)}) — top up at app.didlogic.com/pay before buying.`,
          },
          { status: 402 }
        );
      }
    }

    step = "purchase number";
    const purchase = await purchaseDidlogicNumber(didId);

    step = "create DIDLogic SIP account";
    const sipAccount = await createDidlogicSipAccount(`workroute-${targetBusiness.business_name}`.slice(0, 60));

    step = "route number to SIP account";
    await routeDidlogicNumberToSipAccount(purchase.purchaseId, sipAccount.username);

    step = "create Vapi SIP trunk credential";
    const vapiCredential = await createVapiSipTrunkCredential({
      name: `didlogic-${targetBusiness.business_name}`.slice(0, 60),
      sipUsername: sipAccount.username,
      sipPassword: sipAccount.password,
    });

    step = "create Vapi phone number";
    // Matches the existing working number's own webhook URL exactly
    // (confirmed via GET /phone-number on it) rather than deriving from
    // whatever domain this admin request happened to come from — safer to
    // point every number at the one proven-working origin.
    const vapiPhoneNumber = await createVapiPhoneNumber({
      number: purchase.number,
      credentialId: vapiCredential.id,
      webhookUrl: "https://workroute-v3.vercel.app/api/vapi/webhook",
    });

    step = "save to business profile";
    const { error: updateError } = await serviceRole
      .from("business_profiles")
      .update({
        vapi_phone_number_id: vapiPhoneNumber.id,
        vapi_phone_number: purchase.number,
        didlogic_did_id: purchase.purchaseId,
      })
      .eq("user_id", businessUserId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, step, error: `Everything was created on DIDLogic/Vapi, but saving to the business profile failed: ${updateError.message}. The number IS live — you'll need to paste the phone number ID (${vapiPhoneNumber.id}) into Settings > Phone AI manually.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      number: purchase.number,
      business: targetBusiness.business_name,
      vapiPhoneNumberId: vapiPhoneNumber.id,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, step, error: error instanceof Error ? error.message : "Unknown error." },
      { status: 502 }
    );
  }
}
