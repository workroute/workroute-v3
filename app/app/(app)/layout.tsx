import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthedUser, getBusinessProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { TRADE_QUESTIONS } from "@/lib/trade-questions";
import Sidebar from "./sidebar";
import MobileBottomNav from "./mobile-bottom-nav";

// §27 — the shared shell for every authenticated page. This is the real
// auth gate now (redirect() thrown here halts rendering of all children),
// replacing what used to be a duplicated check on every single page.
// Individual pages still call getAuthedUser() themselves for their own
// user.id-scoped queries and keep their own redirect guard — required by
// TypeScript strict null checks and as a genuine defensive fallback, not
// just relocated boilerplate (see the plan for why). cache() in
// lib/supabase/auth.ts means that's one real network call, not two.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    data: { user },
  } = await getAuthedUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await getBusinessProfile(user.id);

  const supabase = createClient();
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("business_id", user.id)
    .not("attention_priority", "is", null);

  // §49 — a new signup previously had no prompt at all to actually fill in
  // their profile; the post-signup "Welcome" screen only offers the PWA
  // install step. Trade and service area specifically matter beyond just
  // display — they directly drive the phone AI's speech-recognition boost
  // (see lib/phone-ai.ts's buildTranscriberKeywords), so going live without
  // them set means Sarah is missing real accuracy from day one, silently.
  // Shown in the shared layout (not a one-off screen) so it can't be missed
  // by landing on a different page first, and stays until actually resolved
  // rather than being dismissible.
  const missingTradeOrArea = !profile?.trade || !profile?.service_area?.trim();

  // §57 — trade/area alone used to clear this banner even with zero pricing
  // configured, which silently breaks the one thing that actually sells
  // this product: a real quote on the call (lib/phone-ai.ts's
  // computeEstimate). Only checked once a trade is set (nothing to price
  // before then) and only for trades that actually have a question set —
  // see lib/trade-questions.ts.
  let missingPricing = false;
  if (profile?.trade && TRADE_QUESTIONS[profile.trade]?.length) {
    const { data: pricingConfig } = await supabase
      .from("trade_pricing_configs")
      .select("id")
      .eq("business_id", user.id)
      .eq("trade", profile.trade)
      .maybeSingle();
    missingPricing = !pricingConfig;
  }

  const profileIncomplete = missingTradeOrArea || missingPricing;

  return (
    <div className="flex min-h-screen bg-paper-50">
      <Sidebar
        businessName={profile?.business_name ?? ""}
        firstName={profile?.first_name ?? null}
        needsAttentionCount={count ?? 0}
      />
      {/* §32 — bottom padding keeps content clear of the fixed mobile nav;
          desktop doesn't render that nav at all, so no padding needed there. */}
      <div className="min-w-0 flex-1 pb-16 md:pb-0">
        {profileIncomplete && (
          <Link
            href={missingTradeOrArea ? "/app/profile" : "/app/pricing"}
            className="block bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-rig-950 hover:bg-amber-600"
          >
            {missingTradeOrArea
              ? "Finish setting up your business profile — Sarah needs your trade and service area to work properly on calls. Complete profile →"
              : "Set up your pricing — Sarah can't give customers a real quote on the call until pricing is configured. Set up pricing →"}
          </Link>
        )}
        {children}
      </div>
      <MobileBottomNav needsAttentionCount={count ?? 0} />
    </div>
  );
}
