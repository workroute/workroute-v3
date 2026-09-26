import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// §trial-limits — owner-only, same ADMIN_USER_ID gate as the phone-number
// provisioning tool. Flips a business to is_paying so the trial cutoff in
// app/api/vapi/webhook/route.ts's handleAssistantRequest no longer applies —
// there's no automated payment webhook yet (owner's chosen flow: convert
// manually via an external payment link), so this is the one manual step
// standing in for that.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole
    .from("business_profiles")
    .update({ is_paying: true })
    .eq("user_id", params.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
