import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAustralianNumbers, getDidlogicBalance } from "@/lib/didlogic";

// §admin-number-provisioning — owner-only. Gated by ADMIN_USER_ID rather
// than a real role/admin table, since WorkRoute currently has exactly one
// internal user (Steve) — cheap now, easy to upgrade to a real is_admin
// column if that ever changes.
export async function GET(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const city = new URL(request.url).searchParams.get("city");

  try {
    const [numbers, balance] = await Promise.all([searchAustralianNumbers(city), getDidlogicBalance()]);
    return NextResponse.json({ ok: true, numbers, balance });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "DIDLogic search failed." },
      { status: 502 }
    );
  }
}
