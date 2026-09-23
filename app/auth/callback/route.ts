import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWelcomeEmail } from "@/lib/resend";

// Supabase redirects here after a signup confirmation email link is clicked.
// It hands us a one-time "code" which we trade for a real logged-in session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Welcome email — fires once per user, ever. welcome_emails_sent's
    // primary key is the actual idempotency guard (a duplicate insert just
    // fails and we skip sending), not the `next` check below — covers
    // double-clicks on the confirmation link, email clients pre-scanning
    // it, etc. Never blocks the redirect: a failed/unconfigured send just
    // means no email, not a broken signup.
    if (data.user) {
      const serviceRole = createServiceRoleClient();
      // Insert succeeding means this is genuinely the first time (the
      // primary key rejects any repeat); an error here — conflict or
      // otherwise — means don't send, fail closed rather than risk a dupe.
      const { error: insertError } = await serviceRole
        .from("welcome_emails_sent")
        .insert({ user_id: data.user.id });

      if (!insertError && data.user.email) {
        const { data: profile } = await serviceRole
          .from("business_profiles")
          .select("first_name")
          .eq("user_id", data.user.id)
          .maybeSingle();
        await sendWelcomeEmail(data.user.email, profile?.first_name ?? null);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
