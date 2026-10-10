import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notifyAdmin } from "@/lib/push-notifications";
import { assignSpareNumber, countAvailableSpares } from "@/lib/spare-numbers";

// Tells the WorkRoute owner (by push) when a business signs up, and when a
// business that wants the free tablet has saved its pricing. The browser calls
// this after the relevant save; the message is built from the caller's own
// saved business record, never from anything the browser sends, and each
// alert fires once (signup_alerted_at / tablet_ready_alerted_at, migration
// 0044), so refreshing or saving again doesn't repeat it.
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const event = body?.event;
  if (event !== "signup" && event !== "pricing_saved") {
    return NextResponse.json({ ok: false, error: "Unknown event." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("business_profiles")
    .select(
      "business_name, trade, vapi_phone_number, tablet_offer_accepted_at, tablet_sent_at, signup_alerted_at, tablet_ready_alerted_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ok: true, sent: false });
  }

  // The owner's own account doesn't alert himself.
  if (user.id === process.env.ADMIN_USER_ID) {
    return NextResponse.json({ ok: true, sent: false });
  }

  const origin = new URL(request.url).origin;

  if (event === "signup" && !profile.signup_alerted_at) {
    await admin.from("business_profiles").update({ signup_alerted_at: new Date().toISOString() }).eq("user_id", user.id);

    // Give them one of the spare numbers straight away, so Sarah can answer
    // without waiting for the owner. If none is in stock the owner is told.
    let assignedNumber: string | null = null;
    if (!profile.vapi_phone_number) {
      assignedNumber = await assignSpareNumber(admin, user.id);
    }
    const sparesLeft = await countAvailableSpares(admin);

    const parts = [`${profile.business_name} (${profile.trade}) just signed up.`];
    if (assignedNumber) parts.push(`Number ${assignedNumber} connected automatically.`);
    else if (!profile.vapi_phone_number) parts.push("They need a phone number and there's no spare in stock.");
    if (profile.tablet_offer_accepted_at) parts.push("Wants the free tablet.");
    if (sparesLeft === 0) parts.push("No spare numbers left — buy another.");

    await notifyAdmin(admin, "New WorkRoute sign-up", parts.join(" "), origin);
    return NextResponse.json({ ok: true, sent: true });
  }

  if (
    event === "pricing_saved" &&
    profile.tablet_offer_accepted_at &&
    !profile.tablet_sent_at &&
    !profile.tablet_ready_alerted_at
  ) {
    await admin
      .from("business_profiles")
      .update({ tablet_ready_alerted_at: new Date().toISOString() })
      .eq("user_id", user.id);
    await notifyAdmin(
      admin,
      "Tablet ready to post",
      `${profile.business_name} has set up their pricing and wants the free tablet.`,
      origin
    );
    return NextResponse.json({ ok: true, sent: true });
  }

  return NextResponse.json({ ok: true, sent: false });
}
