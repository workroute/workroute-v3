import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TRADE_QUESTIONS } from "@/lib/trade-questions";
import type { TradePricingConfig } from "@/lib/trade-pricing";
import PricingForm from "./pricing-form";

export default async function PricingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("trade")
    .eq("user_id", user.id)
    .maybeSingle();

  const trade = profile?.trade ?? "";
  const questions = TRADE_QUESTIONS[trade] ?? [];

  const { data: existingConfig } = await supabase
    .from("trade_pricing_configs")
    .select("*")
    .eq("business_id", user.id)
    .eq("trade", trade)
    .maybeSingle();

  const initialConfig: TradePricingConfig | null = existingConfig
    ? {
        basePrice: Number(existingConfig.base_price),
        baseDurationMinutes: existingConfig.base_duration_minutes,
        questions: existingConfig.question_pricing ?? {},
      }
    : null;

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-rig-900">Pricing setup</h1>
            <p className="mt-1 text-sm text-rig-700">
              Set a base price/duration for {trade || "your trade"}, then how each job
              detail adjusts it. Captured jobs will calculate their estimate
              automatically from these rules (§31).
            </p>
          </div>
          <Link
            href="/app/profile"
            className="whitespace-nowrap text-sm font-medium text-steel-500 hover:underline"
          >
            ← Settings
          </Link>
        </div>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          {trade && questions.length > 0 ? (
            <PricingForm
              businessId={user.id}
              trade={trade}
              questions={questions}
              initialConfig={initialConfig}
            />
          ) : (
            <p className="text-sm text-rig-700">
              {trade
                ? `No question set is configured yet for "${trade}", so there's nothing to price.`
                : "Set your trade on the business profile page first."}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
