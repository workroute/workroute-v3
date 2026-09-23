import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notifyCustomerNewMessage } from "@/lib/push-notifications";

// §Messenger — the tradie-reply push trigger. messenger-thread.tsx is a
// client component and can't hold the VAPID private key (server-only, see
// lib/push.ts), so it calls this route right after its own RLS-scoped
// message insert succeeds. Auth + ownership check mirrors /api/notify.
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const jobId = body?.jobId;
  if (typeof jobId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing jobId." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("business_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const serviceRole = createServiceRoleClient(); // needed to read the policy-less customer_push_subscriptions
  const appOrigin = new URL(request.url).origin;
  await notifyCustomerNewMessage(serviceRole, jobId, profile?.business_name || "Your tradie", appOrigin);

  return NextResponse.json({ ok: true });
}
