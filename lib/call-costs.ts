// Real vs estimated cost of a phone call, for the Owner Overview.
//
// Measured exactly: what Vapi bills per call (platform + speech-to-text + AI
// model), saved from its end-of-call report (see handleEndOfCallReport in
// app/api/vapi/webhook/route.ts).
//
// Estimated: the two costs Vapi doesn't bill, because they're paid to other
// companies. Change these two numbers when real invoices say otherwise.
export const COST_ESTIMATES = {
  // ElevenLabs. The default Flash voice model uses 0.5 credit per character;
  // at roughly US$0.20 per 1,000 credits that's about US$0.10 per 1,000
  // characters. Doubles if the richer Multilingual model is switched on.
  elevenLabsUsdPer1kChars: 0.1,
  // The phone line (DIDLogic). Replace with the real per-minute rate.
  telephonyUsdPerMinute: 0.02,
} as const;

export type CallCostRow = {
  duration_seconds: number | null;
  vapi_cost_usd: number | string | null;
  tts_characters: number | null;
};

export type CostTotals = {
  calls: number;
  minutes: number;
  vapiUsd: number;
  allInEstimateUsd: number;
};

// Sums a list of calls. Calls with no saved cost (made before tracking
// began) are skipped, so they never drag the averages down.
export function totalCallCosts(rows: CallCostRow[]): CostTotals {
  let calls = 0;
  let seconds = 0;
  let vapiUsd = 0;
  let chars = 0;
  for (const r of rows) {
    if (r.vapi_cost_usd == null || r.duration_seconds == null) continue;
    calls += 1;
    seconds += r.duration_seconds;
    vapiUsd += Number(r.vapi_cost_usd);
    chars += r.tts_characters ?? 0;
  }
  const minutes = seconds / 60;
  const allInEstimateUsd =
    vapiUsd +
    (chars / 1000) * COST_ESTIMATES.elevenLabsUsdPer1kChars +
    minutes * COST_ESTIMATES.telephonyUsdPerMinute;
  return { calls, minutes, vapiUsd, allInEstimateUsd };
}
