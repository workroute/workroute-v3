import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { claimOffer, declineOffer } from "@/lib/gap-fill";

// Public endpoint behind /slot/[token], the page a client lands on from the
// "a spot opened up" text. The token is a long random string only that
// client was sent, so it needs no login. Each action only ever touches the
// one offer the token belongs to.
const TOKEN_RE = /^[0-9a-f]{64}$/;

export async function POST(request: Request, { params }: { params: { token: string } }) {
  if (!TOKEN_RE.test(params.token)) return NextResponse.json({ ok: false, state: "gone" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const supabase = createServiceRoleClient();

  if (action === "claim") {
    const result = await claimOffer(supabase, params.token, new URL(request.url).origin);
    return NextResponse.json(result);
  }
  if (action === "decline" || action === "optout") {
    await declineOffer(supabase, params.token, action === "optout");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
