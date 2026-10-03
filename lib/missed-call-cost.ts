// §missed-call report — the public lead-magnet calculator at /missed-calls.
// Pure maths, no server imports: the page runs it live in the browser and the
// API route re-runs it on the server before emailing, so the visitor's report
// and Steve's lead email always show the same numbers (and a tampered request
// can't put made-up figures in an email we send).

export type MissedCallInputs = {
  callsPerWeek: number;
  missedPct: number; // % of calls that go unanswered
  newWorkPct: number; // % of missed calls that are new work (not spam, suppliers, existing customers)
  noCallbackPct: number; // % of those who ring someone else instead of trying again
  winPct: number; // % of new enquiries the tradie normally wins
  jobValue: number; // average job, $
  jobsPerYear: number; // how often a typical customer books in a year (1 = one-off)
};

export const DEFAULT_INPUTS: MissedCallInputs = {
  callsPerWeek: 20,
  missedPct: 30,
  newWorkPct: 60,
  noCallbackPct: 60,
  winPct: 50,
  jobValue: 250,
  jobsPerYear: 1,
};

export const WORKROUTE_MONTHLY_PRICE = 199;

// Each field's allowed range — used by the sliders and to clamp anything the
// API receives.
export const LIMITS: Record<keyof MissedCallInputs, { min: number; max: number; step: number }> = {
  callsPerWeek: { min: 1, max: 200, step: 1 },
  missedPct: { min: 0, max: 100, step: 5 },
  newWorkPct: { min: 0, max: 100, step: 5 },
  noCallbackPct: { min: 0, max: 100, step: 5 },
  winPct: { min: 0, max: 100, step: 5 },
  jobValue: { min: 0, max: 100000, step: 10 },
  jobsPerYear: { min: 1, max: 52, step: 1 },
};

export function sanitizeInputs(raw: unknown): MissedCallInputs {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_INPUTS };
  for (const key of Object.keys(LIMITS) as (keyof MissedCallInputs)[]) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) {
      out[key] = Math.min(LIMITS[key].max, Math.max(LIMITS[key].min, value));
    }
  }
  return out;
}

export type MissedCallResult = {
  missedPerWeek: number;
  lostEnquiriesPerWeek: number; // new-work callers who went elsewhere
  lostJobsPerWeek: number; // of those, the ones the tradie would have won
  lostCustomersPerYear: number;
  valuePerCustomer: number; // first-year value of one customer
  lostPerMonth: number;
  lostPerYear: number;
  // How many saved jobs a month cover WorkRoute's price.
  jobsToCoverPrice: number;
};

export function calculateMissedCallCost(input: MissedCallInputs): MissedCallResult {
  const missedPerWeek = input.callsPerWeek * (input.missedPct / 100);
  const lostEnquiriesPerWeek = missedPerWeek * (input.newWorkPct / 100) * (input.noCallbackPct / 100);
  const lostJobsPerWeek = lostEnquiriesPerWeek * (input.winPct / 100);
  const lostCustomersPerYear = lostJobsPerWeek * 52;
  const valuePerCustomer = input.jobValue * input.jobsPerYear;
  const lostPerYear = lostCustomersPerYear * valuePerCustomer;
  return {
    missedPerWeek,
    lostEnquiriesPerWeek,
    lostJobsPerWeek,
    lostCustomersPerYear,
    valuePerCustomer,
    lostPerMonth: lostPerYear / 12,
    lostPerYear,
    jobsToCoverPrice: input.jobValue > 0 ? Math.ceil(WORKROUTE_MONTHLY_PRICE / input.jobValue) : 0,
  };
}

export function formatDollars(value: number): string {
  return `$${Math.round(value).toLocaleString("en-AU")}`;
}

// One decimal for small counts ("1.1 jobs a week"), whole numbers otherwise.
export function formatCount(value: number): string {
  return value < 10 ? (Math.round(value * 10) / 10).toLocaleString("en-AU") : Math.round(value).toLocaleString("en-AU");
}

// The WorkRoute sales line (lib/workroute-sales-ai.ts's
// WORKROUTE_SALES_PHONE_NUMBER_ID), where Sarah runs a demo booking.
export const WORKROUTE_DEMO_PHONE = "07 3522 6422";
export const WORKROUTE_SIGNUP_URL = "https://app.workroute.com.au/signup";
