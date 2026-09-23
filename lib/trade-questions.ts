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
export type Question =
  | { id: string; label: string; type: "text"; placeholder?: string; alwaysAsk?: boolean }
  | { id: string; label: string; type: "select"; options: QuestionOption[]; alwaysAsk?: boolean }
  | { id: string; label: string; type: "multiselect"; options: QuestionOption[]; alwaysAsk?: boolean }
  | { id: string; label: string; type: "boolean"; alwaysAsk?: boolean }
  | { id: string; label: string; type: "quantity"; unit: string; min?: number; max?: number; alwaysAsk?: boolean };

// Shorthand for option lists where value === label (the common case).
function opts(labels: string[]): QuestionOption[] {
  return labels.map((label) => ({ value: label, label }));
}

export const TRADE_QUESTIONS: Record<string, Question[]> = {
  "Lawn Mowing": [
    {
      // §26 — the one genuinely missing piece for the deterministic pricing
      // calculator: base price/duration are keyed off this, Slope and
      // Edging (already below) layer on top as adjustments.
      id: "size",
      label: "Lawn size",
      type: "select",
      options: opts(["Small", "Medium", "Large"]),
    },
    {
      id: "service_type",
      label: "One-off or regular service?",
      type: "select",
      options: opts(["One-off", "Regular"]),
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
      id: "obstacles",
      label: "Known obstacles",
      type: "multiselect",
      options: opts(["Rocks", "Branches", "Trees", "Bushes", "Slopes", "None"]),
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
      id: "add_ons",
      label: "Add-on interest",
      type: "multiselect",
      options: opts(["Edging", "Weed spraying"]),
    },
    {
      // Distinct from "obstacles" above (which is about mowing hazards —
      // rocks/branches/slopes) — this is specifically how much there is to
      // trim around, since that's the real time driver for edging, not the
      // mowing itself. Added per the business owner's own real-quoting
      // experience: a plain fence line takes a fraction of the time of a
      // yard with several trees/garden beds to work around.
      id: "edging_complexity",
      label: "Edging complexity",
      type: "select",
      options: opts(["Fence line only", "A few trees or garden beds", "Lots of obstacles"]),
    },
  ],

  "Home Cleaning": [
    { id: "bedrooms", label: "Bedrooms", type: "select", options: opts(["1", "2", "3", "4", "5+"]) },
    { id: "bathrooms", label: "Bathrooms", type: "select", options: opts(["1", "2", "3", "4+"]) },
    {
      id: "levels",
      label: "Single-story or multi-level?",
      type: "select",
      options: opts(["Single-story", "Multi-level"]),
    },
    {
      id: "clean_type",
      label: "Clean type",
      type: "select",
      options: opts(["General", "Deep", "End of lease"]),
    },
    { id: "pets_indoors", label: "Pets indoors?", type: "boolean" },
    {
      id: "add_ons",
      label: "Add-on interest",
      type: "multiselect",
      options: opts(["Oven", "Fridge", "Windows"]),
    },
    {
      id: "products_supplied_by",
      label: "Products supplied by",
      type: "select",
      options: opts(["Customer", "Cleaner"]),
    },
    { id: "entry_method", label: "Entry method", type: "text", placeholder: "e.g. key under mat, customer home" },
  ],

  "Mobile Mechanic": [
    { id: "make", label: "Make", type: "text" },
    { id: "model", label: "Model", type: "text" },
    { id: "year", label: "Year", type: "text", placeholder: "e.g. 2018" },
    { id: "rego", label: "Rego (if available)", type: "text" },
    {
      id: "service_type",
      label: "Logbook service or specific fault?",
      type: "select",
      options: opts(["Logbook service", "Specific fault"]),
    },
    {
      id: "fault_symptom",
      label: "If fault — symptom",
      type: "select",
      options: opts(["Warning light", "Noise", "Won't start", "Other"]),
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
      id: "service_type",
      label: "One-off or regular service?",
      type: "select",
      options: opts(["One-off", "Regular"]),
    },
    {
      // The real time/chemical-cost driver, same role as Lawn Mowing's
      // grass_height — a green recovery is a different job entirely from
      // routine maintenance, not just a bigger version of the same one.
      id: "pool_condition",
      label: "Current condition",
      type: "select",
      options: opts(["Clean — routine maintenance", "Cloudy / algae starting", "Green — needs a full recovery"]),
    },
    {
      id: "pool_type",
      label: "Pool type",
      type: "select",
      options: opts(["Chlorine", "Saltwater", "Mineral"]),
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
      label: "Add-on interest",
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
};

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
  const questions = (TRADE_QUESTIONS[trade] ?? []).filter((q) => idSet.has(q.id));
  return formatQuestionList(questions);
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
