import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOwnSenderActive, normalizeAuMobile, registerOwnSender } from "@/lib/mobile-message";

// §own-mobile-sender — session-authed, only hit from Settings > Text
// messages. GET reports whether the tradie's mobile (business_profiles.phone)
// is an active sender yet; POST asks Mobile Message to text them the
// confirmation link.
async function loadProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("phone, business_name")
    .eq("user_id", user.id)
    .maybeSingle();
  return profile ?? { phone: null, business_name: null };
}

export async function GET() {
  const profile = await loadProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const isMobile = !!normalizeAuMobile(profile.phone);
  return NextResponse.json({
    phone: profile.phone,
    isMobile,
    active: isMobile && (await isOwnSenderActive(profile.phone, true)),
  });
}

export async function POST() {
  const profile = await loadProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!profile.phone) {
    return NextResponse.json({ error: "Add your mobile number in Business details first." }, { status: 400 });
  }
  const result = await registerOwnSender(profile.phone, profile.business_name || "WorkRoute tradie");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
