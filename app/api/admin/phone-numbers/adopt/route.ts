import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createVapiSipTrunkCredential, createVapiPhoneNumber } from "@/lib/vapi-admin";

// §spare-numbers — for a number the owner bought by hand on DIDLogic's own
// website (their API isn't included on the cheaper plan, so the one-click buy
// can't be used). The owner gives the number plus the SIP login and password he
// created for it there. This connects it to Vapi and adds it to the spare
// stock, exactly as "Buy as spare" would have. Owner-only (ADMIN_USER_ID).
// The SIP password is only passed on to Vapi; it isn't stored or logged here.
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rawNumber = typeof body?.number === "string" ? body.number : "";
  const sipUsername = typeof body?.sipUsername === "string" ? body.sipUsername.trim() : "";
  const sipPassword = typeof body?.sipPassword === "string" ? body.sipPassword : "";

  // Accepts 61..., +61... or 04.../07... style and turns it into +61xxxxxxxxx.
  const digits = rawNumber.replace(/\D/g, "");
  const national = digits.startsWith("61") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^\d{9}$/.test(national)) {
    return NextResponse.json(
      { ok: false, error: "That doesn't look like an Australian number. Try +61 7 1234 5678." },
      { status: 400 }
    );
  }
  const number = `+61${national}`;

  if (!sipUsername || !sipPassword) {
    return NextResponse.json({ ok: false, error: "Enter the SIP username and password for this number." }, { status: 400 });
  }

  const serviceRole = createServiceRoleClient();

  const { data: existing } = await serviceRole.from("spare_phone_numbers").select("id").eq("number", number).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, error: `${number} is already in your stock.` }, { status: 409 });
  }
  const { data: inUse } = await serviceRole.from("business_profiles").select("user_id").eq("vapi_phone_number", number).maybeSingle();
  if (inUse) {
    return NextResponse.json({ ok: false, error: `${number} is already connected to a business.` }, { status: 409 });
  }

  let step = "create Vapi SIP trunk credential";
  try {
    const vapiCredential = await createVapiSipTrunkCredential({
      name: `didlogic-spare ${number}`.slice(0, 60),
      sipUsername,
      sipPassword,
    });

    step = "create Vapi phone number";
    const vapiPhoneNumber = await createVapiPhoneNumber({
      number,
      credentialId: vapiCredential.id,
      webhookUrl: "https://workroute-v3.vercel.app/api/vapi/webhook",
    });

    step = "save to spare numbers";
    const { error: spareError } = await serviceRole.from("spare_phone_numbers").insert({
      number,
      vapi_phone_number_id: vapiPhoneNumber.id,
      didlogic_did_id: null,
    });
    if (spareError) {
      return NextResponse.json(
        {
          ok: false,
          step,
          error: `The number was connected to Vapi, but saving it to your stock failed: ${spareError.message}. Vapi phone number ID: ${vapiPhoneNumber.id}.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, number, vapiPhoneNumberId: vapiPhoneNumber.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, step, error: error instanceof Error ? error.message : "Unknown error." },
      { status: 502 }
    );
  }
}
