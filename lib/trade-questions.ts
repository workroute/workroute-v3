// §8a — trade-specific question sets. Keyed by the exact trade string
// stored on business_profiles.trade. Add a new trade here and it
// automatically becomes available on the job capture form.
//
// Option `value` is the stable key stored in jobs.trade_answers and used to
// key pricing rules (§31, see lib/trade-pricing.ts) — it must never be
// renamed once in use. `label` is display text only and is free to change.
// For every option that predates this split, value is set identical to the
// original label text, so historical trade_answers still match.

export type QuestionOption = { value: string; label: string };

// alwaysAsk: true means this gets asked on every call regardless of whether
// any option has a price attached — for things worth knowing to prepare for
// the job (locked gates, pets on property) but that aren't meant to change
// the quote. Everything else only gets asked when it actually affects price
// (see pricingQuestionIds in app/api/vapi/webhook/route.ts) — asking every
// generic question regardless of relevance is what made an earlier version
// of the phone AI slow.
// aiClassifiedFrom: this question affects price but is never asked aloud —
// the AI works out the value itself from another question's already-known
// answer (named here by id), using its own judgment, rather than asking the
// caller a question they couldn't meaningfully answer. e.g. a mechanic
// pricing by vehicle brand tier: asking "what price tier is your car?"
// would be bizarre, but Sarah already knows the make from a normal
// question and can classify it herself.
// defaultVaryBy: on the Pricing page this question's price starts out varying
// by the answer to another select question (named by id) instead of one flat
// number, e.g. Edging by Lawn size. Only a starting point for a business that
// hasn't saved prices for this question yet.
export type Question =
  | { id: string; label: string; type: "text"; placeholder?: string; alwaysAsk?: boolean; aiClassifiedFrom?: string; defaultVaryBy?: string }
  | { id: string; label: string; type: "select"; options: QuestionOption[]; alwaysAsk?: boolean; aiClassifiedFrom?: string; defaultVaryBy?: string }
  | { id: string; label: string; type: "multiselect"; options: QuestionOption[]; alwaysAsk?: boolean; aiClassifiedFrom?: string; defaultVaryBy?: string }
  | { id: string; label: string; type: "boolean"; alwaysAsk?: boolean; aiClassifiedFrom?: string; defaultVaryBy?: string }
  | { id: string; label: string; type: "quantity"; unit: string; min?: number; max?: number; alwaysAsk?: boolean; aiClassifiedFrom?: string; defaultVaryBy?: string };

// Shorthand for option lists where value === label (the common case).
function opts(labels: string[]): QuestionOption[] {
  return labels.map((label) => ({ value: label, label }));
}

export const TRADE_QUESTIONS: Record<string, Question[]> = {
  "Lawn Mowing": [
    {
      // §26 — the one genuinely missing piece for the deterministic pricing
      // calculator: base price/duration are keyed off this, and the
      // questions below layer on top as adjustments.
      id: "size",
      label: "Lawn size",
      type: "select",
      options: opts(["Small", "Medium", "Large"]),
    },
    {
      id: "grass_height",
      label: "Time since last mow / grass height",
      type: "select",
      options: opts([
        "Just mowed — short",
        "2–4 weeks — medium",
        "1–2 months+ — long / overgrown",
      ]),
    },
    {
      // Deliberately alwaysAsk, not priced — per the business owner, this is
      // a heads-up for the tradie to prepare for (a locked gate or a dog in
      // the yard changes how he approaches the job), not something worth
      // charging extra for.
      id: "access",
      label: "Access",
      type: "multiselect",
      alwaysAsk: true,
      options: opts(["Side gate", "Gate locked — key/code needed", "Pets on property"]),
    },
    {
      // Kept deliberately simple (owner's call, 2026-10-08): obstacles,
      // edging complexity, weed spraying and a one-off/regular price were all
      // dropped as over-engineering the quote. Edging is one tick, and its
      // price starts out varying by lawn size (a big lawn has more edge).
      // The id stays "add_ons" so any previously saved Edging price carries
      // over.
      id: "add_ons",
      label: "Edging as well?",
      type: "multiselect",
      options: opts(["Edging"]),
      defaultVaryBy: "size",
    },
  ],

  "Home Cleaning": [
    // Kept simple (owner's call, 2026-10-08): single vs multi-level and who
    // supplies the products were dropped so a basic price is quick to set up.
    { id: "bedrooms", label: "Bedrooms", type: "select", options: opts(["1", "2", "3", "4", "5+"]) },
    { id: "bathrooms", label: "Bathrooms", type: "select", options: opts(["1", "2", "3", "4+"]) },
    {
      id: "clean_type",
      label: "Clean type",
      type: "select",
      options: opts(["General", "Deep", "End of lease"]),
    },
    // A heads-up for the cleaner, not a price: asked on every call, never
    // shown on the Pricing page.
    { id: "pets_indoors", label: "Pets indoors?", type: "boolean", alwaysAsk: true },
    {
      id: "add_ons",
      label: "Extras",
      type: "multiselect",
      options: opts(["Oven", "Fridge", "Windows"]),
    },
    { id: "entry_method", label: "Entry method", type: "text", placeholder: "e.g. key under mat, customer home" },
  ],

  "Mobile Mechanic": [
    {
      // The price-list driver, same role as a salon's "service": each job a
      // mechanic quotes gets its own price and time on the Pricing page.
      // Anything open-ended ("Diagnose a fault", "Other") is normally set to
      // "requires quote" there rather than given a fixed price.
      id: "service_type",
      label: "What needs doing?",
      type: "select",
      options: opts([
        "Logbook service",
        "Brakes",
        "Battery",
        "Air-conditioning",
        "Pre-purchase inspection",
        "Diagnose a fault",
        "Other",
      ]),
    },
    {
      id: "fault_symptom",
      label: "If a fault — symptom",
      type: "select",
      options: opts(["Warning light", "Noise", "Won't start", "Other"]),
    },
    { id: "make", label: "Make", type: "text" },
    {
      // §brand-tier — real parts/labour cost genuinely varies by brand (a
      // Toyota vs a Mercedes), but asking a caller "what price tier is your
      // car?" directly would be a bizarre question they couldn't answer.
      // Sarah classifies this herself from "make" above once she has it —
      // see aiClassifiedFrom on the Question type.
      //   Standard             — Japanese, Korean, Australian and American
      //                          makes (Toyota, Mazda, Hyundai, Kia, Ford...)
      //   European             — VW, Audi, BMW, Mercedes-Benz, Volvo, Skoda...
      //   Luxury / performance — Porsche, Land Rover, Maserati, Tesla, etc.
      id: "brand_tier",
      label: "Vehicle brand tier",
      type: "select",
      options: opts(["Standard", "European", "Luxury / performance"]),
      aiClassifiedFrom: "make",
    },
    { id: "model", label: "Model", type: "text" },
    { id: "year", label: "Year", type: "text", placeholder: "e.g. 2018" },
    { id: "rego", label: "Rego (if available)", type: "text" },
    {
      id: "fuel_type",
      label: "Fuel type",
      type: "select",
      options: opts(["Petrol", "Diesel", "Hybrid / electric"]),
    },
    {
      // Sarah works this out from the model ("Hilux" is a ute, "Prado" a
      // 4WD) rather than asking the caller to categorise their own vehicle.
      id: "vehicle_type",
      label: "Vehicle type",
      type: "select",
      options: opts(["Car / hatch", "SUV / 4WD", "Ute / van"]),
      aiClassifiedFrom: "model",
    },
    {
      id: "cylinders",
      label: "Cylinders",
      type: "select",
      options: opts(["4 cylinder", "6 cylinder", "8 cylinder+"]),
    },
    {
      id: "parts_supplied_by",
      label: "Parts supplied by",
      type: "select",
      options: opts(["Tradie", "Customer"]),
    },
    {
      id: "access",
      label: "Access",
      type: "select",
      options: opts(["Flat space available to jack up safely", "No flat space / limited access"]),
    },
    { id: "key_handover", label: "Key handover method", type: "text" },
  ],

  "Pool Cleaning": [
    {
      id: "size",
      label: "Pool size",
      type: "select",
      options: opts(["Small (under 30,000L)", "Medium (30,000–50,000L)", "Large (50,000L+)"]),
    },
    {
      // The real time/chemical-cost driver, same role as Lawn Mowing's
      // grass_height — a green recovery is a different job entirely from
      // routine maintenance, not just a bigger version of the same one.
      // Kept simple (owner's call, 2026-10-08): one-off/regular and pool type
      // were dropped so a basic price is quick to set up. Above-ground vs
      // in-ground stays: it genuinely changes the job.
      id: "pool_condition",
      label: "Current condition",
      type: "select",
      options: opts(["Clean — routine maintenance", "Cloudy / algae starting", "Green — needs a full recovery"]),
    },
    {
      id: "pool_style",
      label: "Above-ground or in-ground?",
      type: "select",
      options: opts(["Above-ground", "In-ground"]),
    },
    {
      // Same alwaysAsk rationale as Lawn Mowing's own access question —
      // worth knowing before the job, not something that changes the quote.
      id: "access",
      label: "Access",
      type: "multiselect",
      alwaysAsk: true,
      options: opts(["Side gate", "Gate locked — key/code needed", "Pets on property"]),
    },
    {
      id: "add_ons",
      label: "Extras",
      type: "multiselect",
      options: opts(["Filter clean", "Equipment check", "Acid wash"]),
    },
    {
      id: "equipment_notes",
      label: "Any known equipment issues?",
      type: "text",
      placeholder: "e.g. pump noisy, chlorinator not reading",
    },
  ],

  Landscaping: [
    {
      id: "scope",
      label: "Softscaping or hardscaping?",
      type: "select",
      options: opts(["Softscaping", "Hardscaping", "Both"]),
    },
    {
      id: "project_type",
      label: "New build or renovation?",
      type: "select",
      options: opts(["New build", "Renovation"]),
    },
    {
      id: "access",
      label: "Access",
      type: "select",
      options: opts(["Machine access", "Wheelbarrow-only access"]),
    },
    {
      id: "ground",
      label: "Ground level or sloped?",
      type: "select",
      options: opts(["Level", "Sloped"]),
    },
    {
      id: "budget_range",
      label: "Budget range",
      type: "select",
      options: opts(["Under $5k", "$5k–$15k", "$15k–$30k", "$30k+", "Not sure yet"]),
    },
    {
      id: "timeline",
      label: "Desired timeline",
      type: "select",
      options: opts(["ASAP", "Within 1 month", "1–3 months", "Flexible"]),
    },
  ],

  // Fixed-location trades (see FIXED_LOCATION_TRADES below) — the customer
  // comes to the business, so there's no address or travel to ask about.
  // `service` is the price/duration driver the same way Lawn Mowing's `size`
  // is, so a salon sets base price + per-option durations on the Pricing page.
  Hairdressing: [
    {
      id: "service",
      label: "Service",
      type: "select",
      options: opts(["Mens cut", "Womens cut", "Kids cut", "Colour", "Cut and colour", "Foils / highlights", "Treatment", "Other"]),
    },
    {
      id: "hair_length",
      label: "Hair length",
      type: "select",
      options: opts(["Short", "Medium", "Long"]),
    },
    {
      // alwaysAsk, not priced — worth knowing so the right person is
      // scheduled, but it never changes the quote.
      id: "stylist_preference",
      label: "Preferred stylist (if any)",
      type: "text",
      placeholder: "e.g. Jess, or no preference",
      alwaysAsk: true,
    },
  ],

  Massage: [
    {
      id: "massage_type",
      label: "Type of massage",
      type: "select",
      options: opts(["Relaxation", "Remedial", "Deep tissue", "Sports", "Pregnancy", "Other"]),
    },
    {
      id: "session_length",
      label: "Session length",
      type: "select",
      options: opts(["30 minutes", "60 minutes", "90 minutes"]),
    },
    {
      // alwaysAsk, not priced — a heads-up so the therapist can prepare.
      id: "therapist_preference",
      label: "Preferred therapist (if any)",
      type: "text",
      placeholder: "e.g. Sam, or no preference",
      alwaysAsk: true,
    },
    {
      id: "health_notes",
      label: "Injuries or health conditions to know about",
      type: "text",
      alwaysAsk: true,
    },
  ],
};

// Single source of truth for "which trades exist" — anywhere that needs a
// dropdown of trades (profile setup, quick start) should read this rather
// than hand-maintaining its own copy of the list.
export const TRADE_NAMES = Object.keys(TRADE_QUESTIONS);

// Trades where the customer comes to the business rather than the business
// going to them: no customer address, no service-area check, no drive-time
// check, and (see business_profiles.chairs) more than one booking can happen
// at the same time. Everything else is a mobile trade, exactly as before.
export const FIXED_LOCATION_TRADES = new Set(["Hairdressing", "Massage"]);

// The trade_answers key and spoken word for "ask for a particular person" —
// null for mobile trades, which have no staff picker.
export function staffPreference(trade: string | null | undefined): { questionId: string; role: string } | null {
  if (trade === "Hairdressing") return { questionId: "stylist_preference", role: "stylist" };
  if (trade === "Massage") return { questionId: "therapist_preference", role: "therapist" };
  return null;
}

// Trades whose Pricing page is a plain price list (a price and a time for each
// job or service) rather than "base price plus adjustments": every salon
// style business, and mobile mechanics, who quote a list of distinct jobs.
export function usesPriceList(trade: string | null | undefined): boolean {
  return isFixedLocationTrade(trade) || trade === "Mobile Mechanic";
}

export function isFixedLocationTrade(trade: string | null | undefined): boolean {
  return !!trade && FIXED_LOCATION_TRADES.has(trade);
}

export const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "missed_call", label: "Missed call" },
  { value: "sms", label: "SMS" },
  { value: "form", label: "Form" },
];

export const CONFIDENCE_OPTIONS = ["High", "Medium", "Low"] as const;

// §31 — used by both lib/phone-ai.ts and lib/widget-ai.ts to tell the model
// the *exact* valid values for each question, not just its id. Without
// this, the model plausibly-guesses a value ("large", "overgrown") that
// doesn't exact-match any real option string ("Large", "1–2 months+ — long
// / overgrown") — computeEstimate (lib/trade-pricing.ts) does a plain
// object-key lookup per option, so a near-miss doesn't error, it just
// silently contributes nothing to the price. Confirmed on a real capture
// where the model's own reasonable-sounding values matched zero configured
// options.
function formatQuestionList(questions: Question[]): string {
  if (questions.length === 0) return "(none configured for this trade yet)";

  return questions
    .map((q) => {
      if (q.type === "select" || q.type === "multiselect") {
        return `${q.id} (${q.type}): exactly one of ${q.options.map((o) => `"${o.value}"`).join(", ")}`;
      }
      if (q.type === "boolean") return `${q.id} (boolean): true or false`;
      if (q.type === "quantity") return `${q.id} (number${q.unit ? `, ${q.unit}` : ""})`;
      return `${q.id} (free text)`;
    })
    .join("; ");
}

export function describeQuestionsForPrompt(trade: string): string {
  return formatQuestionList(TRADE_QUESTIONS[trade] ?? []);
}

// §phone-AI-depth — same exact-value-matching purpose as describeQuestionsForPrompt
// above, but scoped to only the question ids a business has actually wired
// into trade_pricing_configs (lib/trade-pricing.ts's TradePricingConfig.questions
// — a question with no pricing entry contributes nothing to computeEstimate).
// Used by the phone AI to ask only what genuinely moves the price, not the
// full generic question set — asking through every question regardless of
// whether it affects price is exactly what made an earlier version of the
// phone AI slow and frustrating on real calls.
export function describePricingQuestionsForPrompt(trade: string, pricingQuestionIds: string[]): string {
  const idSet = new Set(pricingQuestionIds);
  // §brand-tier — an aiClassifiedFrom question is never asked directly, so
  // it's excluded here and surfaced instead via
  // describeAiClassifiedQuestionsForPrompt below.
  const questions = (TRADE_QUESTIONS[trade] ?? []).filter((q) => idSet.has(q.id) && !q.aiClassifiedFrom);
  return formatQuestionList(questions);
}

// §brand-tier — the counterpart to describePricingQuestionsForPrompt: tells
// the AI which pricing factors to work out itself (from an answer it
// already has) instead of asking the caller. Scoped the same way — only
// questions the business has actually priced, via pricingQuestionIds.
export function describeAiClassifiedQuestionsForPrompt(trade: string, pricingQuestionIds: string[]): string {
  const idSet = new Set(pricingQuestionIds);
  const all = TRADE_QUESTIONS[trade] ?? [];
  const questions = all.filter((q) => idSet.has(q.id) && q.aiClassifiedFrom);
  if (questions.length === 0) return "";

  return questions
    .map((q) => {
      const sourceLabel = all.find((sq) => sq.id === q.aiClassifiedFrom)?.label ?? q.aiClassifiedFrom;
      const validValues = q.type === "select" || q.type === "multiselect" ? q.options.map((o) => `"${o.value}"`).join(", ") : "";
      return `${q.id} — never ask this directly; once you know "${sourceLabel}", classify it yourself into exactly one of ${validValues} using your own judgment, and call update_job_draft with that value under trade_answers.${q.id}`;
    })
    .join(". ");
}

// §50 — kept deliberately separate from describePricingQuestionsForPrompt:
// these questions (e.g. locked gates, pets on property) are worth asking on
// every call, but never affect price — mixing them into the same "these
// questions determine your price" prompt section risked the model
// literally telling a caller their locked gate adds to the cost.
export function describeAlwaysAskQuestionsForPrompt(trade: string): string {
  const questions = (TRADE_QUESTIONS[trade] ?? []).filter((q) => q.alwaysAsk);
  return formatQuestionList(questions);
}

export function alwaysAskQuestionIds(trade: string): string[] {
  return (TRADE_QUESTIONS[trade] ?? []).filter((q) => q.alwaysAsk).map((q) => q.id);
}
