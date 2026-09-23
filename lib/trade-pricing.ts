// §31 — per-business pricing rules layered on top of the shared question
// sets in lib/trade-questions.ts. Questions/options are the same for every
// tradie on a given trade; prices are not, so pricing lives here as a
// separate structure keyed against the same question ids and option values,
// stored per business in trade_pricing_configs (see
// supabase/migrations/0011_trade_pricing.sql).

import type { SupabaseClient } from "@supabase/supabase-js";

export type Adjustment = {
  priceDelta: number; // dollars, can be negative
  durationDelta: number; // minutes, can be negative
};

// An option can adjust price/duration directly, force a manual quote, or
// (§edging-by-size) vary its adjustment depending on the answer to another
// select question on the same job — e.g. Edging costs a different amount
// depending on Lawn size, rather than one flat add-on price regardless of
// yard size. Deliberately general (dependsOnQuestionId is any other select
// question's id, not hardcoded to "size") so this covers the same need for
// any other trade/question pairing later, not just this one.
export type OptionPricing =
  | Adjustment
  | { requiresQuote: true }
  | { dependsOnQuestionId: string; values: Record<string, Adjustment> };

export type QuestionPricing =
  | { type: "select"; options: Record<string, OptionPricing> } // keyed by option value
  | { type: "multiselect"; options: Record<string, OptionPricing> } // every selected option applies
  | { type: "boolean"; onTrue: OptionPricing; onFalse?: OptionPricing }
  | { type: "quantity"; perUnit: Adjustment }; // multiplied by the entered number

export type TradePricingConfig = {
  basePrice: number;
  baseDurationMinutes: number;
  // Keyed by question id. A question with no entry here contributes nothing.
  questions: Record<string, QuestionPricing>;
};

const ZERO: Adjustment = { priceDelta: 0, durationDelta: 0 };

function isQuoteOverride(opt: OptionPricing): opt is { requiresQuote: true } {
  return "requiresQuote" in opt;
}

function isDependent(opt: OptionPricing): opt is { dependsOnQuestionId: string; values: Record<string, Adjustment> } {
  return "dependsOnQuestionId" in opt;
}

// Resolves an OptionPricing down to a plain Adjustment (or the quote-override
// signal), given the full answers map — dependent pricing needs to look up
// another question's already-known answer to know which value applies.
// Missing/unrecognised dependency answers fall back to ZERO rather than
// blocking the estimate — a job shouldn't require a manual quote just
// because, say, Lawn size hasn't been asked yet on this particular call.
function resolveAdjustment(
  opt: OptionPricing,
  answers: Record<string, string | string[] | boolean | number | undefined>
): Adjustment | "quote" {
  if (isQuoteOverride(opt)) return "quote";
  if (isDependent(opt)) {
    const dependencyAnswer = answers[opt.dependsOnQuestionId];
    if (typeof dependencyAnswer !== "string") return ZERO;
    return opt.values[dependencyAnswer] ?? ZERO;
  }
  return opt;
}

export type EstimateResult =
  | { quoteRequired: true }
  | { quoteRequired: false; price: number; durationMinutes: number };

// Every question type is a pure additive delta on top of basePrice /
// baseDurationMinutes — there's no notion of one question "being the base",
// which avoids ambiguity when a trade has more than one select question.
export function computeEstimate(
  answers: Record<string, string | string[] | boolean | number | undefined>,
  pricing: TradePricingConfig
): EstimateResult {
  let price = pricing.basePrice;
  let duration = pricing.baseDurationMinutes;

  for (const [questionId, questionPricing] of Object.entries(pricing.questions)) {
    const answer = answers[questionId];
    if (answer === undefined || answer === null) continue;

    if (questionPricing.type === "select") {
      const opt = questionPricing.options[answer as string];
      if (!opt) continue;
      const resolved = resolveAdjustment(opt, answers);
      if (resolved === "quote") return { quoteRequired: true };
      price += resolved.priceDelta;
      duration += resolved.durationDelta;
    } else if (questionPricing.type === "multiselect") {
      for (const value of answer as string[]) {
        const opt = questionPricing.options[value];
        if (!opt) continue;
        const resolved = resolveAdjustment(opt, answers);
        if (resolved === "quote") return { quoteRequired: true };
        price += resolved.priceDelta;
        duration += resolved.durationDelta;
      }
    } else if (questionPricing.type === "boolean") {
      const opt = (answer ? questionPricing.onTrue : questionPricing.onFalse) ?? ZERO;
      const resolved = resolveAdjustment(opt, answers);
      if (resolved === "quote") return { quoteRequired: true };
      price += resolved.priceDelta;
      duration += resolved.durationDelta;
    } else if (questionPricing.type === "quantity") {
      const count = answer as number;
      price += questionPricing.perUnit.priceDelta * count;
      duration += questionPricing.perUnit.durationDelta * count;
    }
  }

  return { quoteRequired: false, price, durationMinutes: duration };
}

// Shared row → TradePricingConfig mapping, used by both the manual job
// capture form (app/app/(app)/jobs/new/page.tsx) and the phone AI
// (lib/phone-ai.ts) so there's one place that knows the trade_pricing_configs
// column shape. Returns null if this business hasn't configured pricing for
// the given trade yet — callers should treat that as "always Quote Required".
export async function loadTradePricingConfig(
  supabase: SupabaseClient,
  businessId: string,
  trade: string
): Promise<TradePricingConfig | null> {
  const { data: row } = await supabase
    .from("trade_pricing_configs")
    .select("base_price, base_duration_minutes, question_pricing")
    .eq("business_id", businessId)
    .eq("trade", trade)
    .maybeSingle();

  if (!row) return null;

  return {
    basePrice: Number(row.base_price),
    baseDurationMinutes: row.base_duration_minutes,
    questions: row.question_pricing ?? {},
  };
}
