import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { TABLET_DELIVERY_DAYS } from "@/lib/tablet-offer";

// §tablet-offer — owner-only, same ADMIN_USER_ID gate as mark-paying. Records
// that the owner has posted the tablet and moves the business's free trial to
// start when it should arrive, so the post doesn't eat into the trial.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const now = new Date();
  const trialStart = new Date(now.getTime() + TABLET_DELIVERY_DAYS * 86400000);

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole
    .from("business_profiles")
    .update({ tablet_sent_at: now.toISOString(), trial_started_at: trialStart.toISOString() })
    .eq("user_id", params.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
