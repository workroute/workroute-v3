import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { assignSpareNumber, releaseNumber } from "@/lib/spare-numbers";

// §spare-numbers — owner-only (ADMIN_USER_ID). Gives a business a spare number
// by hand (for accounts that signed up when none was in stock), or takes its
// number back into stock when it leaves.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "assign" && action !== "release") {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  // The owner's own account carries WorkRoute's sales line; never touch it.
  if (params.id === user.id) {
    return NextResponse.json({ ok: false, error: "That's your own account — its number can't be changed here." }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  if (action === "assign") {
    const number = await assignSpareNumber(admin, params.id);
    if (!number) {
      return NextResponse.json({ ok: false, error: "No spare number is available (or they already have one)." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, number });
  }

  const result = await releaseNumber(admin, params.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
