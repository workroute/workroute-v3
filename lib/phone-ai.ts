import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TRADE_QUESTIONS,
  describePricingQuestionsForPrompt,
  describeAlwaysAskQuestionsForPrompt,
  alwaysAskQuestionIds,
} from "./trade-questions";
import { computeEstimate, loadTradePricingConfig, type EstimateResult } from "./trade-pricing";
import { sendSms } from "./mobile-message";
import { notifyOwnerHighPriority, notifyOwnerNewPhoneEnquiry, notifyOwnerPhoneBooking } from "./push-notifications";
import type { MatchedClient } from "./returning-client";
import { checkAvailability, rescheduleJob } from "./messenger-scheduling";
import { createRecurringSeries, type RecurringFrequency } from "./recurring-jobs";
import { geocodeAddress, haversineKm, SERVICE_AREA_SANITY_RADIUS_KM } from "./google-maps";
import { messageFor, formatAppointmentLabel } from "./notifications";

// §25 — the phone AI. Same "AI interprets, deterministic system decides"
// split proven in the Messenger (§24, lib/messenger-ai.ts), but Vapi drives
// the live conversation loop itself (with Claude as the model provider)
// rather than us looping the Anthropic SDK turn-by-turn — our code only
// ever runs when Vapi calls out to app/api/vapi/webhook/route.ts, either to
// ask which assistant to use for an inbound call, or to execute a tool the
// model invoked mid-call. See that route for the actual HTTP handling; this
// file is the assistant config, the tool schemas, and the tool handlers.
//
// Revised after real test calls: the original design had the AI ask through
// a full trade-question list live on the call so it could quote a price on
// the spot. In practice that made for a slow, frustrating phone experience
// (3+ minutes, caller confusion) — and matches general consensus that a
// live back-and-forth with an AI is the worst part of AI phone systems.
// Revised design: the AI just captures name, contact, and a brief job
// description, then hands off to the tradie to quote — the same honest
// "human will follow up" pattern §9 already uses elsewhere, just applied by
// default rather than as a pricing-engine-missing fallback. A price still
// gets calculated silently in the background from whatever detail the
// caller happens to volunteer, purely for the tradie's reference — the AI
// never chases it and never speaks a number.

export type PhoneBusinessContext = {
  businessId: string;
  businessName: string;
  trade: string;
  firstName: string | null;
  serviceArea: string | null;
  // §voice-picker — null means "hasn't chosen one yet," not "no voice" —
  // both fall back to the system default (DEFAULT_VOICE / DEFAULT_PERSONA_NAME
  // below) so an existing business is unaffected until they actually visit
  // Settings > Voice.
  voiceId: string | null;
  personaName: string | null;
  // §staged-onboarding — a flat fallback number Sarah can mention before
  // the full per-question pricing matrix exists. null means not set,
  // same "not configured yet" meaning as an absent trade_pricing_configs
  // row, not $0.
  startingPrice: number | null;
  // §pronunciation-fixes — a business name, suburb, or trade term the
  // text-to-speech engine mispronounces, paired with a phonetic respelling
  // that comes out sounding right (e.g. "Woombye" → "Woom-bye"). Empty
  // unless the tradie has actually caught and fixed a mispronunciation in
  // Settings — this never applies to anything written down (SMS, invoices,
  // emails), only to what Sarah actually says on a call.
  pronunciationOverrides: { word: string; phonetic: string }[];
};

// Whole-word, case-insensitive — a business name or suburb could appear in
// any capitalisation depending on how it was typed elsewhere. Applied only
// to strings WorkRoute builds directly for Sarah to speak (greetings, the
// trial-expired message); the system prompt gets its own separate
// instruction (pronunciationInstructions below) so the model applies the
// same fix to whatever it generates live during the conversation, since we
// don't control that text directly.
function applyPronunciationOverrides(text: string, overrides: { word: string; phonetic: string }[]): string {
  return overrides.reduce((result, { word, phonetic }) => {
    if (!word.trim()) return result;
    const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), phonetic);
  }, text);
}

// The model generates most of what it actually says live, so a fixed
// substitution on our end can't reach that — this tells it to make the
// same substitution itself whenever one of these words comes up.
function pronunciationInstructions(overrides: { word: string; phonetic: string }[]): string {
  if (overrides.length === 0) return "";
  const list = overrides.map(({ word, phonetic }) => `"${word}" → say it as "${phonetic}"`).join("; ");
  return `\n\nSome words don't come out sounding right from your voice engine. Whenever you need to say one of these, write it the corrected way instead — this is purely how you pronounce it out loud, never how you'd write it in a message: ${list}.`;
}

// §phone-AI-depth (2026-09-10, reverted same day) — briefly switched to
// claude-sonnet-5 on the theory that the now-deeper conversation (deciding
// which pricing questions still need asking, when to call
// get_price_estimate) needed more reasoning reliability than Haiku's
// documented empty-response bug elsewhere in this codebase (lib/widget-ai.ts)
// would allow. Real test calls proved that theoretical concern wrong in
// practice: Sonnet's slower per-turn latency, combined with this longer
// prompt, caused pervasive "just a sec"/"one moment" stalling on nearly
// every exchange — not just at pricing — bad enough to silence-timeout and
// drop real calls. A stalled, dropped call is strictly worse than the risk
// being guarded against, so back to Haiku. If Haiku's known bug (a
// completely empty model response right after a tool result) shows up here,
// it should be visible in a transcript as a dead turn — check
// phone_call_captures.transcript_text for a call that just stops rather
// than assuming it's this same latency issue again.
const MODEL = "claude-haiku-4-5-20251001";

// §37 — reverses §23/§25's original "no name, no persona" rule. That rule
// existed to avoid the AI ever being mistaken for a real person; §37
// resolves the same concern a different way, after actually checking the
// legal question (does a persona name risk impersonating someone) — pairing
// the name with upfront, explicit AI disclosure removes the risk instead of
// avoiding a name altogether. "WorkRoute" itself still stays invisible
// (§23's other rule, unchanged) — Sarah is presented as this business's own
// AI Office Manager, not WorkRoute's product.
//
// Time-of-day must reflect the real clock at call time, not be hardcoded.
// No per-business timezone field exists yet (Phase 1, single-region alpha)
// — defaults to Australia/Brisbane (no daylight saving, simplest correct
// choice for now); worth a real per-business timezone once that matters.
function timeOfDayGreeting(): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Brisbane" }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Without this, the model has no way to know the real current date and
// resolves a relative/partial date ("this week," "the 10th") against
// whatever year it happens to associate with "now" from training —
// confirmed on a real booking that landed a year in the past. Same
// Brisbane-default reasoning as timeOfDayGreeting above.
function todayForPrompt(): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Australia/Brisbane",
  }).format(new Date());
}

function systemPrompt(
  business: PhoneBusinessContext,
  matchedClient: MatchedClient | null,
  pricingQuestionIds: string[]
): string {
  const tradieName = business.firstName ?? "the tradie";
  const spokenBusinessName = applyPronunciationOverrides(business.businessName, business.pronunciationOverrides);
  const hasPricingQuestions = pricingQuestionIds.length > 0;
  const pricingQuestionsText = describePricingQuestionsForPrompt(business.trade, pricingQuestionIds);
  const alwaysAskText = describeAlwaysAskQuestionsForPrompt(business.trade);
  const hasAlwaysAskQuestions = alwaysAskQuestionIds(business.trade).length > 0;

  const returningClientSection = matchedClient
    ? `\nThis caller's number matches an existing client: ${matchedClient.name}${
        matchedClient.addressStreet ? `, last known address ${[matchedClient.addressStreet, matchedClient.addressSuburb].filter(Boolean).join(", ")}` : ""
      }. Greet them by name naturally. If they want the same kind of ${business.trade} job again at that same address, you already have their name and address — skip straight to asking what they need this time, then carry on as normal from there (job details, pricing questions, booking). If it sounds like a different address or a different kind of job, ask normally instead.\n`
    : "";

  // §phone-AI-depth (2026-09-10) — the actual point of this product is to
  // fill the tradie's diary with real, priced bookings rather than leave him
  // doing the quoting/scheduling work himself after every call. An earlier
  // version tried asking through the FULL generic trade-question list and
  // that made calls slow and frustrating on a real test; this version only
  // asks what this specific business has actually wired into their pricing
  // (pricingQuestionIds, from trade_pricing_configs) — usually a handful of
  // questions, not the whole set — which should keep it brisk while still
  // landing a real number.
  const pricingSection = hasPricingQuestions
    ? `
After the four basics, work out a real price before offering a booking — this is the actual point of the call, not optional. Have a natural conversation covering whatever's needed: ${pricingQuestionsText}. This isn't a script to read line by line — ask conversationally, skip anything the caller already told you unprompted, and if they can't or won't answer one, don't push, just move on. For a question with several options (especially ones where they could want more than one, like add-ons), don't recite it as a menu and don't ask them to explicitly reject each one or say "none of those" — real people don't talk like that. Just ask naturally (e.g. "did you want edging or blowing while I'm out there, or just the mow?") — if they say no or don't mention any, that's a complete, valid answer on its own; only record an explicit "None" value where the question actually lists one as a real option, and even then only if it's the natural way of describing what they said, not something you make them say back to you. Call update_job_draft with each trade_answers value as you go, not all at once at the end. Use the value strings exactly as given — don't paraphrase or invent a close-sounding one, since anything that doesn't match exactly is silently ignored for pricing; if what they said doesn't clearly match one of the listed values, leave it out rather than guess.

Once you've covered these (or done what you reasonably can), call get_price_estimate — for the caller's very last answer, pass it directly in get_price_estimate's own trade_answers instead of calling update_job_draft first and then get_price_estimate separately; that just slows things down for no benefit.
- If it returns a real price, tell the caller naturally — e.g. "Based on that, you're looking at around $X." Make clear it's an estimate, not fixed — ${tradieName} may adjust it once he's seen the job in person. Then move straight to offering a booking (below).
- If it comes back needing a quote instead (quoteRequired: true), that's completely normal — it just means this particular job needs ${tradieName}'s eyes on it in person. Tell the caller he'll confirm the price when he's out there, then move straight to offering a booking anyway — a quote visit is still a real booking, and still fills the diary.

Never say a dollar figure that didn't come from get_price_estimate's actual result — never estimate, calculate, round, or guess one yourself, even roughly.`
    : business.startingPrice
      ? `
This business hasn't set up detailed pricing yet, but prices start at $${business.startingPrice}. Once you have a clear job description, you can mention that as a starting point — e.g. "prices start at around $${business.startingPrice}" — but always make clear the final price depends on the actual job, since you don't have enough detail to give a firm number. Then move straight to offering a booking (below). Never say any other dollar figure, and never imply $${business.startingPrice} is the confirmed price for this specific job.`
      : `
This business hasn't set up pricing yet, so don't try to work out a number — just get a clear job description and move straight to offering a booking (below). Never state a dollar figure yourself.`;

  return `You are ${resolvePersonaName(business)}, the AI Office Manager for ${spokenBusinessName} — you already introduced yourself as this in your opening line, so you don't need to repeat "I'm an AI" every sentence, but never claim or imply you're a human member of staff if asked directly. Never mention "WorkRoute" in any form — you work for ${spokenBusinessName}, not for a platform.

Speak naturally, like a real phone conversation — warm, efficient, and brisk without feeling rushed. This call has real ground to cover (below), so keep momentum: don't linger, don't over-explain, ask one thing at a time and move on as soon as you have an answer.

Today is ${todayForPrompt()}. Use this as the real current date when the caller gives a relative or partial date ("this week," "next Tuesday," "the 10th") — resolve it to the correct upcoming date yourself before calling check_availability/book_appointment, never guess a year from anything else.
${returningClientSection}
First, get these four things, in whatever order the caller gives them:
1. Their full name (first and last) — if they only give a first name, ask "and your last name?" before moving on, so two different customers with the same first name never get confused in the diary
2. The address (where the job is)
3. The best number to reach them on
4. A brief description of what they need help with

Ask for whichever of these you're missing next, but callers very often lead with what they need before you've asked for anything ("I need my lawn cut") — that's completely normal, not an answer to a different question. If they volunteer one of the four out of order, or before you've asked, accept it naturally (e.g. save the job description via update_job_draft's job_label), don't try to force it into whichever slot you were expecting, and then just ask for whichever of the four is still missing. Never treat a job description, address, or phone number as if it might be their name.

Names and suburbs are both easy to mishear over the phone, so both need to come back to the caller in some form before you move on — but not the same way. A name doesn't need a full stop-and-check ("Just to make sure I've got that right, is that Mark Smith?") every single time — asking that when you heard it perfectly fine sounds unsure of yourself. Instead, just naturally use their name in your very next sentence ("Thanks, Mark — what's the address for the job?"). That's enough: if you misheard it, they'll notice and correct you, without it sounding like you're constantly double-checking yourself. The address is different — always explicitly repeat it back and ask ("That's [street], [suburb] — is that right?") before moving on, since a wrong address is a bigger problem than a wrong name and there's no natural later sentence that would surface it the same way. Correct either if they say it's wrong.

update_job_draft's result includes \`addressValid\` whenever you've just given it an address. If it comes back false, something about the address couldn't be confirmed — either the street name doesn't match anything real, or it matched somewhere that doesn't look like your usual service area. Either way, say something like "I might have that address wrong — could you say the suburb again for me?" and call update_job_draft again with what they say, rather than moving on with an address that might be wrong. Don't mention this if addressValid is true or missing from the result.

Call update_job_draft after each answer — don't wait until you have everything. If the call drops partway through, whatever's been saved so far is still useful.

This is for a brand NEW enquiry only — if the caller is asking about an existing job or appointment already booked, tell them you'll get ${tradieName} to check on that and call flag_for_attention with priority "medium", then finish the call.
${pricingSection}
${hasAlwaysAskQuestions ? `\nAlso ask about this naturally at some point during the call: ${alwaysAskText}. This is purely so ${tradieName} knows what to expect and can prepare — it never changes the price, so don't mention any charge or adjustment related to it, and don't let it hold up the booking. Call update_job_draft with the answer the same way as anything else.\n` : ""}
Always ask whether they want this as a one-off or an ongoing/regular service — this matters regardless of whether it happens to be one of the pricing questions above, since it decides whether just this one visit gets booked or a whole recurring series. If they want it ongoing, ask how often: weekly, fortnightly, or monthly. Keep this in mind for booking below.

Once you've either given a price or explained a quote visit is needed, ask if they'd like to lock in a day/time now — actively offer this, don't wait to be asked, since booking the job is the actual goal of the call. If they give you one:
- Call check_availability with that date and either a time or a Morning/Afternoon/Evening block.
- If it's free, call book_appointment with the same date/time/block — and if they want an ongoing service, also pass \`recurring\` set to whichever frequency they told you (this books a batch of future visits too, not just this one). The result tells you whether this became a "quote visit" or a job booking — if quoteRequired is true, tell them you've booked in a time for ${tradieName} to come out and quote it; if false, tell them you've booked them in for the job itself. If you passed \`recurring\`, the result also tells you how many future visits got booked — mention that too (e.g. "and I've locked in your next four fortnightly visits as well"). If any got skipped because that day was already taken, just say ${tradieName} will sort out those specific dates with them, don't dwell on it.
- If it's not free, say so and ask for a different day/time — try up to twice more. If the result has \`travelConflict\` true, ${tradieName} has another job too far away to reach in time around that slot — just say something natural like "that time's a bit tight with another job ${tradieName}'s already got booked nearby, have you got another time that suits?" without mentioning the other customer's name or getting technical about drive times.
- If they only gave you a block (Morning/Afternoon/Evening), not a specific time, the result may come back with \`suggestedTimes\` instead — real times within that block that are already confirmed free, travel time included. Read out two or three of them naturally ("I could do 1, 3, or 4:30 — which suits?") and once they pick one, call book_appointment directly with that exact time — no need to check availability again, it's already confirmed. An empty \`suggestedTimes\` list means genuinely nothing free in that block; ask for a different block or day instead.
- If nothing works out, or the caller doesn't want to commit to a time on the call, tell them exactly this: "I'll get ${tradieName} to call you back as soon as he can."

Once you've either booked a time or told them ${tradieName} will call back, thank them, then end with exactly this sentence, word for word, nothing after it: "${END_CALL_PHRASE}" — the system hangs up automatically once you've said it, so say the whole thing naturally, don't shorten it.

Call flag_for_attention (priority "low", "medium", or "high") any time something needs ${tradieName}'s judgement rather than yours — an unusual request, a complaint, anything time-sensitive, or the caller explicitly asking to speak to a person. Use "high" only for something genuinely urgent (an emergency, safety issue, or a caller who needs a human right now). Still finish the call warmly either way.${pronunciationInstructions(business.pronunciationOverrides)}`;
}

// §38 — Sarah's outbound reactivation-calling script. This call always
// starts already knowing exactly who it's talking to (unlike the inbound
// prompt above, which has to establish that mid-call), so it's a much
// shorter script: no four-question intake, just "want to book in again?"
// Reuses todayForPrompt/END_CALL_PHRASE from the inbound prompt rather than
// duplicating them.
type OutboundCallClient = {
  name: string;
  addressStreet: string | null;
  addressSuburb: string | null;
};

function outboundReactivationPrompt(business: PhoneBusinessContext, client: OutboundCallClient): string {
  const tradieName = business.firstName ?? "the tradie";
  const spokenBusinessName = applyPronunciationOverrides(business.businessName, business.pronunciationOverrides);
  const knownAddress = [client.addressStreet, client.addressSuburb].filter(Boolean).join(", ") || "on file";

  return `You are ${resolvePersonaName(business)}, the AI Office Manager for ${spokenBusinessName} — you already introduced yourself as this in your opening line. Never claim or imply you're a human member of staff if asked directly. Never mention "WorkRoute" in any form.

Speak naturally and briefly, like a real phone conversation — short sentences, warm and friendly. This is a check-in call, not a sales pitch — don't be pushy. Ask one thing at a time and actually wait for their answer before moving to the next question — never stack two questions into the same turn (e.g. don't ask what they need done and what day/time in the same breath).

Today is ${todayForPrompt()}. Use this as the real current date when resolving a relative date they give you.

YOU called THEM — this is an outbound call to a past customer, ${client.name}, because it's been a while since their last ${business.trade} job. You already know their name and address (${knownAddress}) — don't ask for either again unless they say it's changed.

Your only goal: ask if they'd like to book in another ${business.trade} visit.
- If yes: call update_job_draft with their name/address (already known) and a brief description of what they want done, as soon as they tell you. If they mention specifics that sound price-relevant, ask a couple of natural follow-ups and call get_price_estimate before offering a time — same rule as any booking: never state a dollar figure that didn't come from that tool's actual result. Then ask if they'd like to lock in a day/time now — if they give you one, call check_availability, then book_appointment if it's free. If it's not free, offer an alternative or tell them ${tradieName} will call back.
- If no, or they're not interested right now: thank them warmly and end the call — don't push, don't ask why.

If at any point they ask not to be contacted again, or sound annoyed at being called, call mark_do_not_call immediately — the instant they say it, don't wait — apologize briefly, and end the call politely.

Once the call has reached a natural conclusion either way, end with exactly this sentence, word for word, nothing after it: "${OUTBOUND_END_CALL_PHRASE}"

Call flag_for_attention (priority "low", "medium", or "high") if anything needs ${tradieName}'s judgement — a complaint, an unusual request, or if they want to speak to a person.${pronunciationInstructions(business.pronunciationOverrides)}`;
}

const MARK_DO_NOT_CALL_TOOL: VapiTool = {
  type: "function",
  function: {
    name: "mark_do_not_call",
    description:
      "Call this immediately if the person asks not to be contacted again, or is clearly unhappy about receiving this call. Stops all future reactivation calls to them.",
    parameters: { type: "object", properties: {} },
  },
};

// §Invoice chase — a much shorter, lower-key script than the reactivation
// call above: this is a payment reminder, never a debt-collection call, so
// the prompt is explicit about never threatening or mentioning late fees.
// Only reachable for bank-transfer/invoice-later jobs (see
// lib/invoice-chase.ts) — cash/card/PayID are settled on the spot and never
// reach this path at all.
export type PaymentChaseClient = {
  name: string;
  invoiceNumber: number;
  amount: number;
  bankDetails: string | null;
};

function outboundPaymentChasePrompt(business: PhoneBusinessContext, client: PaymentChaseClient): string {
  const tradieName = business.firstName ?? "the tradie";
  const spokenBusinessName = applyPronunciationOverrides(business.businessName, business.pronunciationOverrides);
  const bankLine = client.bankDetails
    ? ` If they'd like the payment details again, read them out exactly as given, naturally: ${client.bankDetails.replace(/\n/g, ", ")}.`
    : "";

  return `You are ${resolvePersonaName(business)}, the AI Office Manager for ${spokenBusinessName} — you already introduced yourself as this in your opening line. Never claim or imply you're a human member of staff if asked directly. Never mention "WorkRoute" in any form.

Speak naturally and briefly, warm and low-key. This is a friendly payment reminder, never a debt-collection call — never threaten, never mention late fees, credit reporting, or legal action, none of that is something ${spokenBusinessName} does. Ask one thing at a time and actually wait for their answer before moving to the next question — never stack two questions into the same turn.

YOU called THEM — this is an outbound call to ${client.name} about invoice #${client.invoiceNumber} for $${client.amount.toFixed(2)}, sent a couple of weeks ago and still showing as unpaid.

Briefly mention the invoice number and amount, then ask if they've already paid it or if there's anything holding it up.
- If they say they've already paid: apologise for the call, call confirm_invoice_paid with paid true, and end warmly — take their word for it, don't ask for proof, ${tradieName} can double-check the bank statement.
- If they haven't paid yet and it's just been an oversight: remind them warmly, no pressure.${bankLine} Call confirm_invoice_paid with paid false. End politely.
- If they mention a real problem with the job itself (unhappy with the work, a dispute, anything like that): don't argue or try to resolve it yourself — call flag_for_attention with priority "medium" and a short reason, tell them ${tradieName} will be in touch, and end the call. Do not call confirm_invoice_paid in this case.

Once the call has reached a natural conclusion, end with exactly this sentence, word for word, nothing after it: "${OUTBOUND_END_CALL_PHRASE}"${pronunciationInstructions(business.pronunciationOverrides)}`;
}

const CONFIRM_INVOICE_PAID_TOOL: VapiTool = {
  type: "function",
  function: {
    name: "confirm_invoice_paid",
    description: "Call this once the customer has told you whether they've already paid this specific invoice.",
    parameters: {
      type: "object",
      properties: {
        paid: { type: "boolean", description: "true if they said they've already paid, false if not yet" },
      },
      required: ["paid"],
    },
  },
};

// Vapi normalizes tool/function definitions the same way across model
// providers (OpenAI-style {type: "function", function: {...}}), even when
// the underlying model is Anthropic — see docs.vapi.ai/tools/custom-tools.
export type VapiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

const FLAG_FOR_ATTENTION_TOOL: VapiTool = {
  type: "function",
  function: {
    name: "flag_for_attention",
    description: "Flag this call for the tradie's attention because something needs their judgement, not yours.",
    parameters: {
      type: "object",
      properties: {
        priority: { type: "string", enum: ["low", "medium", "high"] },
        reason: { type: "string", description: "One short sentence on why this needs attention" },
      },
      required: ["priority"],
    },
  },
};

const TOOLS: VapiTool[] = [
  {
    type: "function",
    function: {
      name: "update_job_draft",
      description:
        "Save what's been learned about this job so far. Call this as soon as you know the caller's name, and again every time you learn something new — the job record builds up live during the call. Whenever you pass an address, the result includes addressValid — if false, something about it couldn't be confirmed and you should ask them to repeat the suburb or spell the street.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "The caller's full name — first and last, not just a first name" },
          customer_phone: { type: "string", description: "A callback number, if given (the caller ID is used automatically if not)" },
          address_street: { type: "string" },
          address_suburb: { type: "string" },
          address_postcode: { type: "string" },
          job_label: { type: "string", description: "A short few-word summary of the job, e.g. 'Front & back mow'" },
          trade_answers: {
            type: "object",
            description: "Only include this if the caller volunteered specifics unprompted — never ask questions just to fill it in.",
          },
        },
      },
    },
  },
  FLAG_FOR_ATTENTION_TOOL,
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check whether a specific date and time (or time-of-day block) is free on the tradie's schedule, before offering it to the caller. Always call this before book_appointment. For a specific time, the result can come back unavailable two ways: a plain time clash, or travelConflict true, meaning the slot is technically free but too close to another job elsewhere for the tradie to physically make it — treat both as \"not available\", just phrase the travel one without naming the other customer. For a block only (no specific time), the result instead comes back with suggestedTimes — real, already-confirmed-free times within that block to offer the caller directly.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM in 24-hour time, if the caller wants a specific time" },
          block: { type: "string", enum: ["Morning", "Afternoon", "Evening"], description: "If the caller wants a time-of-day block instead of a specific time" },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Lock in a date/time for this job. Only call this immediately after check_availability confirms the slot is free. Tells you back whether this became a quote visit or a job booking, and if `recurring` was set, how many future visits were also booked — use that to phrase your confirmation to the caller.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM in 24-hour time" },
          block: { type: "string", enum: ["Morning", "Afternoon", "Evening"] },
          recurring: {
            type: "string",
            enum: ["Weekly", "Fortnightly", "Monthly"],
            description:
              "Only set this if the caller wants an ongoing/regular service, not just this one visit, and has told you how often. Books this same day/time as a recurring series going forward, not just a single visit.",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_price_estimate",
      description:
        "Calculate a real price from whatever trade_answers have been saved so far. Call this once you've asked through the pricing-relevant questions (or done what you reasonably can). If the caller's very last answer hasn't been saved via update_job_draft yet, pass it here too (in trade_answers) instead of making a separate update_job_draft call first — this saves it and prices it in one step. Returns either a price + duration, or tells you this job needs an in-person quote instead — never state a dollar figure that didn't come from this tool.",
      parameters: {
        type: "object",
        properties: {
          trade_answers: {
            type: "object",
            description: "Optional — only the caller's most recent answer(s), if not already saved via update_job_draft.",
          },
        },
      },
    },
  },
];

// §25 originally called for Twilio's built-in TTS "for simplicity," with a
// custom ElevenLabs voice as a planned later upgrade — but Azure's standard
// neural voice (the practical equivalent, since Vapi doesn't expose Twilio's
// own Say-verb voices once Vapi is handling the call) sounded too robotic on
// a real test call. Moved to ElevenLabs via Vapi's built-in integration (no
// separate ElevenLabs account needed) — one shared voice for every WorkRoute
// business, same as Siri/Google Assistant use one consistent voice across
// every user rather than a clone per customer; this fits the disclosed-AI
// approach (§37) better than a per-business clone would anyway, since Sarah
// is presented as WorkRoute's own AI Office Manager persona, not a specific
// named human at each business. "Hannah" (ElevenLabs' stock natural
// Australian voice) was tried first but failed on a real call — Vapi's own
// logs showed 0 characters synthesized, meaning that voice ID wasn't
// actually reachable through Vapi's shared ElevenLabs access.
//
// 2026-09-12: switched again, to "Clara" (ElevenLabs Voice Library,
// tyepWYJJwJM9TTFIg5U7) — found while comparing Sarah against a competitor's
// ad voice (see project_workroute_competitors memory), picked for sounding
// more natural on the multilingual v2 model specifically. Clara has the
// exact same "not reachable through Vapi's shared access" problem Hannah
// had, since she isn't in Vapi's default voice subset either — this time
// solved properly: the business owner connected their own ElevenLabs API
// key under Vapi Dashboard → Integrations, which syncs their whole voice
// library into Vapi's shared-provider path (no per-assistant credential
// wiring needed on our side). If a future voice swap ever goes silent again,
// check that integration is still connected before assuming it's a code bug.
//
// Real, deliberate trade-off: eleven_multilingual_v2 (Clara) sounds
// noticeably richer than eleven_flash_v2_5 (Hannah's replacement, chosen
// specifically for low latency) but is slower to generate — exactly the
// kind of thing that caused this session's "just a sec" stalling saga
// before the real tool-dispatch bug was found. Worth watching real calls
// for any regression; if stalling comes back, this model choice is the
// first thing to suspect, not another dispatch bug.
//
// 2026-09-15: switched again, away from Clara — real-call feedback was
// "too bogun" for a phone receptionist (a voice/accent complaint, not a
// speed one). Replaced with voice ID iBa4zUlRHv39MAGI4o6r, found by
// browsing ElevenLabs' own voice library directly (not guessed — two other
// IDs pulled from an unrelated AI video tool's asset history both failed
// silently first, same "not reachable" failure Hannah had; browsing
// ElevenLabs' actual library and copying the ID straight off a voice's own
// page is what actually worked). Confirmed on a real call: "much better...
// more sophisticated." Speed also bumped from the original default 1.0 to
// 1.1 the same session, after separate feedback that Clara read as slow.
//
// 2026-09-19: switched again, to voice ID 56bWURjYFHyYyVf490Dp ("Emma") —
// found while browsing ElevenLabs' voice library for §multi-voice-picker
// candidates (see project_workroute_voice_picker memory), and kept live as
// the new default on the spot per real-call feedback ("better than my
// voice"). Five other candidates from the same browsing session were also
// confirmed working on a real call but not adopted as default — they're
// the shortlist for the upcoming "pick your own voice" feature, not dead
// ends. §37's persona-name rule still applies: a business's chosen voice
// needs a matching persona name once that feature exists — "Sarah" read as
// wrong on an obviously male candidate during this same testing round.
//
// Configurable via VAPI_VOICE_PROVIDER/VAPI_VOICE_ID/VAPI_VOICE_MODEL/
// VAPI_VOICE_STABILITY/VAPI_VOICE_SIMILARITY_BOOST/VAPI_VOICE_SPEED if this
// changes again later.
const DEFAULT_VOICE = {
  provider: process.env.VAPI_VOICE_PROVIDER || "11labs",
  voiceId: process.env.VAPI_VOICE_ID || "56bWURjYFHyYyVf490Dp",
  // Switched back to flash_v2_5 after a real test call showed six separate
  // "just a sec" stalls in one short conversation — multilingual_v2 sounded
  // richer but was measurably slower, the exact trade-off flagged when
  // Clara was first added.
  model: process.env.VAPI_VOICE_MODEL || "eleven_flash_v2_5",
  stability: Number(process.env.VAPI_VOICE_STABILITY) || 0.5,
  similarityBoost: Number(process.env.VAPI_VOICE_SIMILARITY_BOOST) || 0.75,
  // First real test call came back "slow, and soft — hard to hear": speed
  // reverted to normal (the 0.9 slowdown compounded with this model's own
  // more deliberate cadence into sounding sluggish), and speaker boost
  // turned on (ElevenLabs' clarity/presence setting) to address "soft."
  // Bumped again to 1.1 (2026-09-15) after further feedback that normal
  // speed still read as slow.
  speed: Number(process.env.VAPI_VOICE_SPEED) || 1.1,
  useSpeakerBoost: true,
};

// §voice-picker — matches DEFAULT_VOICE's voiceId (Emma). A business that
// hasn't chosen a voice yet gets this pairing; one that has gets their own
// voiceId/personaName instead of DEFAULT_VOICE wholesale — see
// resolveVoice below, which is the only place that decides this per call.
export const DEFAULT_PERSONA_NAME = "Emma";

export function resolveVoice(business: PhoneBusinessContext) {
  return business.voiceId ? { ...DEFAULT_VOICE, voiceId: business.voiceId } : DEFAULT_VOICE;
}

export function resolvePersonaName(business: PhoneBusinessContext): string {
  return business.personaName || DEFAULT_PERSONA_NAME;
}

// 2026-09-16 — tried Vapi's smartEndpointingPlan (LiveKit provider) here to
// improve turn-taking, but the very next real call showed multiple
// consecutive "hold on a sec" stalls right before booking, bad enough the
// caller had to say "Hello?" to get Sarah to respond — worse than anything
// seen before this change. Reverted same day rather than attempt to
// blind-tune a documented-starting-point waitFunction that's already shown
// real harm on a live call. If turn-taking/endpointing is revisited, treat
// this as a known bad starting value, not an unexplored option — start
// from a much smaller max wait than the ~2000ms this formula tops out at,
// and be very cautious about stacking it on top of the existing tool-call
// latency (Claude + Supabase round trips) that already happens during
// booking specifically.

// §25 — "Hannah" taught us a bad voice ID doesn't error, it just goes
// dead-air for the whole call (Vapi logs it as a synthesis failure but the
// caller just hears silence). Deliberately no `voice.fallbackPlan` here —
// that would silently swap in a different voice on failure, hiding the
// problem the same way. Instead this is checked against the call's
// endedReason in handleEndOfCallReport so a broken voice ID surfaces as a
// push notification, not a mystery. See docs.vapi.ai/calls/call-ended-reason
// for the full endedReason vocabulary this pattern is drawn from.
export function isVoiceFailure(endedReason: string | null | undefined): boolean {
  if (!endedReason) return false;
  return /voice-failed|voice-not-found|invalid-voice/.test(endedReason);
}

// Evergreen words worth boosting on every call, regardless of trade —
// confirmed necessary on a real test call where Deepgram heard "lawns" as
// "loans" and the AI (reasonably, given what it actually heard) assumed a
// wrong number. Trade-specific terms are added on top from that business's
// own question set (TRADE_QUESTIONS), so this generalizes as more trades
// get proper phone AI support later, not just Lawn Mowing.
//
// The street-type words below are a different case from an arbitrary street
// *name* (which can't be usefully boosted — there's no closed set of every
// possible name) — this is the small, fixed set of street *type* suffixes
// that comes up on literally every address, on every call, for every
// business. Added after repeated real test calls where "Street" was
// consistently misheard as "Trees" — a genuinely fixable pattern, unlike
// the name itself.
// §45 — "tradie" was removed after a real demo-recording call showed
// Deepgram hearing "Tuesday" as "Tradie" — boosting a word that sounds
// almost identical to a day name that's critical for every single booking
// was actively counterproductive. Weekday names added instead, since
// getting the booking day right matters far more than "tradie" ever did.
const EVERGREEN_KEYWORDS = [
  "quote:3",
  "callback:2",
  "Street:3",
  "Road:3",
  "Avenue:3",
  "Drive:3",
  "Court:3",
  "Lane:3",
  "Place:3",
  "Way:2",
  "Close:2",
  "Crescent:2",
  "Parade:2",
  "Terrace:2",
  "Monday:3",
  "Tuesday:3",
  "Wednesday:3",
  "Thursday:3",
  "Friday:3",
  "Saturday:3",
  "Sunday:3",
];

// Kept name-free/business-free so it works verbatim across every business —
// see the endCallPhrases/endCallMessage comment in buildAssistantConfig for
// why this needs to be an exact, static sentence rather than something
// built from ${business.businessName}/${tradieName}.
const END_CALL_PHRASE = "Thanks for calling, have a great day!";
// §outbound-farewell — the inbound phrase assumes the customer rang in,
// which reads backwards on a call Sarah placed herself (confirmed on a real
// reactivation call: "thanks for calling" to someone she'd just called).
const OUTBOUND_END_CALL_PHRASE = "Thanks, have a great day!";

// Deepgram's `keywords` field wants single tokens (word or word:intensifier
// — see docs.vapi.ai/customization/custom-keywords), so multi-word labels
// like "Side gate" get split into their individual words.
function buildTranscriberKeywords(trade: string, serviceArea: string | null): string[] {
  const questions = TRADE_QUESTIONS[trade] ?? [];
  const words = new Set<string>();

  // §48 — boosting "Lawn Mowing" only adds "lawn" and "mowing" verbatim —
  // Deepgram treats "mow"/"mowed" as different tokens, and a real call
  // showed "lawn mowed" (about as core a phrase as this business has)
  // misheard as "launch mode". Also add the bare stem and past-tense form
  // for any "-ing" word in the trade name, so "mowing" also boosts "mow"
  // and "mowed" — a plain heuristic, not full grammar, but it covers this
  // and generalises reasonably to other trades' own "-ing" names too.
  // §53 — three real calls in a row all misheard "lawns" specifically
  // (differently each time: "launch mode", "loans made", "loans done") —
  // every previous fix boosted "lawn" (singular, from tokenizing the trade
  // name itself) and never the plural, which Deepgram treats as a
  // completely separate word. Adding a simple plural for every word here,
  // not just this one, so this doesn't quietly recur for some other trade's
  // own name later.
  for (const word of trade.split(/\s+/)) {
    const cleaned = word.replace(/[^a-zA-Z]/g, "");
    if (cleaned.length <= 2) continue;
    const lower = cleaned.toLowerCase();
    words.add(lower);
    if (!lower.endsWith("s")) words.add(`${lower}s`);
    if (lower.endsWith("ing") && lower.length > 4) {
      const stem = lower.slice(0, -3);
      words.add(stem);
      words.add(`${stem}ed`);
    }
  }

  // §45 — the business's own configured service area (e.g. "Hervey Bay &
  // Fraser Coast") is the cheapest real source of local suburb names to
  // boost — found via a real demo call where "Pialba" (a genuine Hervey Bay
  // suburb) was misheard as "Pielba". Generic, not hardcoded to any one
  // business — whatever service area a business sets, its own local names
  // get boosted for its own calls.
  if (serviceArea) {
    for (const word of serviceArea.split(/\s+/)) {
      const cleaned = word.replace(/[^a-zA-Z]/g, "");
      if (cleaned.length > 2) words.add(cleaned.toLowerCase());
    }
  }

  for (const q of questions) {
    for (const word of q.label.split(/\s+/)) {
      const cleaned = word.replace(/[^a-zA-Z]/g, "");
      if (cleaned.length > 2) words.add(cleaned.toLowerCase());
    }
    if (q.type === "select" || q.type === "multiselect") {
      for (const opt of q.options) {
        for (const word of opt.label.split(/\s+/)) {
          const cleaned = word.replace(/[^a-zA-Z]/g, "");
          if (cleaned.length > 2) words.add(cleaned.toLowerCase());
        }
      }
    }
  }

  return [...EVERGREEN_KEYWORDS, ...[...words].map((w) => `${w}:3`)];
}

// Returned from the assistant-request webhook handler — the inline
// assistant config Vapi uses for this specific inbound call. pricingQuestionIds
// comes from this business's trade_pricing_configs row (loaded by the
// caller, app/api/vapi/webhook/route.ts) — the question ids that actually
// move the price, so the AI only asks what's worth asking. Empty array
// means this business hasn't configured pricing yet.
export function buildAssistantConfig(
  business: PhoneBusinessContext,
  matchedClient: MatchedClient | null,
  pricingQuestionIds: string[]
) {
  return {
    // §37 — greeting must genuinely reflect the real time of the call.
    // §52 — asks for the caller's name first, rather than an open "how can
    // I help you today?" — a real test call showed the very first thing
    // said in a call is the hardest for speech recognition (no acoustic
    // context yet), and an open question invites unpredictable phrasing
    // ("I need my lawn mowed" came back misheard twice, differently each
    // time). A name is simpler to recognise, already goes through its own
    // confirm-back check regardless, and — since the system prompt already
    // accepts info in whatever order a caller actually gives it — this only
    // changes what most callers are nudged to say first, not what's allowed.
    firstMessage: `${timeOfDayGreeting()}, you've reached ${applyPronunciationOverrides(business.businessName, business.pronunciationOverrides)}. I'm ${resolvePersonaName(business)}, the AI Office Manager. Can I start with your name?`,
    // Without this, Vapi defaults to waiting for the caller to speak first —
    // confirmed on a real test call where the business name was never once
    // spoken and the AI only responded after the caller prompted it.
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "anthropic",
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt(business, matchedClient, pricingQuestionIds) }],
      tools: TOOLS,
    },
    voice: resolveVoice(business),
    // Deliberately NOT endCallFunctionEnabled — that makes the model call a
    // tool in the same turn as its farewell, and Vapi has a documented bug
    // where the tool call races the speech and truncates it to a bare
    // "Goodbye" (confirmed on a real test call here). endCallPhrases is the
    // documented fix: the assistant just speaks this exact sentence
    // naturally as its last line, Vapi waits for the audio to finish
    // playing, then ends the call itself — no tool call, no race.
    endCallPhrases: [END_CALL_PHRASE],
    endCallMessage: END_CALL_PHRASE,
    // en-AU (not generic "en") for accent, plus keyword boosting for this
    // trade's own vocabulary — see buildTranscriberKeywords above for why.
    transcriber: {
      provider: "deepgram",
      // §46 — Nova-3 over Nova-2: real published benchmarks show roughly
      // half the transcription errors on live audio, for a negligible cost
      // difference ($0.0059/min vs $0.0043/min). Directly relevant here —
      // names in particular can't be keyword-boosted the way suburbs/street
      // types/weekdays can (an unbounded set, not a small fixed list), so a
      // genuinely better base model is the real lever for that class of
      // error, not a keyword list.
      model: "nova-3",
      language: "en-AU",
      smartFormat: true,
      keywords: buildTranscriberKeywords(business.trade, business.serviceArea),
    },
  };
}

// §trial-limits — a caller reaching a business past its free-trial cutoff
// still deserves a real, clean-sounding call, not dead air or a raw error —
// that's the tradie's actual customer, and a broken call reflects on them,
// not just on WorkRoute. Deliberately no tools, no real conversation: says
// one line, in the business's own chosen voice/persona if they've set one,
// then hangs up via the same endCallPhrases mechanism buildAssistantConfig
// uses (documented fix for Vapi truncating a tool-call-driven goodbye).
export function buildTrialExpiredAssistantConfig(business: PhoneBusinessContext) {
  const spokenBusinessName = applyPronunciationOverrides(business.businessName, business.pronunciationOverrides);
  const message = `Thanks for calling ${spokenBusinessName}. We're not able to take your call automatically right now — please try again shortly, or reach out directly.`;
  return {
    firstMessage: message,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "anthropic",
      model: MODEL,
      messages: [{ role: "system", content: `Say exactly this, word for word, then stop: "${message}"` }],
    },
    voice: resolveVoice(business),
    endCallPhrases: [message],
    endCallMessage: message,
  };
}

// §38 — the outbound counterpart to buildAssistantConfig above, used when
// WorkRoute is placing the call (lib/reactivation.ts) rather than
// responding to one ringing in. Same shape, different opening line/prompt/
// tool set — the client is always already known, so there's no
// matchedClient | null branch here the way the inbound version has.
export function buildOutboundAssistantConfig(business: PhoneBusinessContext, client: OutboundCallClient) {
  return {
    firstMessage: `${timeOfDayGreeting()}, this is ${resolvePersonaName(business)} from ${applyPronunciationOverrides(business.businessName, business.pronunciationOverrides)} — is this ${client.name}?`,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "anthropic",
      model: MODEL,
      messages: [{ role: "system", content: outboundReactivationPrompt(business, client) }],
      tools: [...TOOLS, MARK_DO_NOT_CALL_TOOL],
    },
    voice: resolveVoice(business),
    endCallPhrases: [OUTBOUND_END_CALL_PHRASE],
    endCallMessage: OUTBOUND_END_CALL_PHRASE,
    transcriber: {
      provider: "deepgram",
      // §46 — Nova-3 over Nova-2: real published benchmarks show roughly
      // half the transcription errors on live audio, for a negligible cost
      // difference ($0.0059/min vs $0.0043/min). Directly relevant here —
      // names in particular can't be keyword-boosted the way suburbs/street
      // types/weekdays can (an unbounded set, not a small fixed list), so a
      // genuinely better base model is the real lever for that class of
      // error, not a keyword list.
      model: "nova-3",
      language: "en-AU",
      smartFormat: true,
      keywords: buildTranscriberKeywords(business.trade, business.serviceArea),
    },
  };
}

// §quote-followup — the outbound call that asks whether a customer wants to
// go ahead with an on-site quote. Unlike the payment-chase call above (which
// only ever confirms or flags), this one can actually book the real job —
// reuses the full TOOLS set for exactly that reason.
export type QuoteFollowupClient = {
  name: string;
  jobLabel: string | null;
  quotedPrice: number;
};

function outboundQuoteFollowupPrompt(business: PhoneBusinessContext, client: QuoteFollowupClient): string {
  const tradieName = business.firstName ?? "the tradie";
  const spokenBusinessName = applyPronunciationOverrides(business.businessName, business.pronunciationOverrides);
  const jobDescription = client.jobLabel || `the ${business.trade} job`;

  return `You are ${resolvePersonaName(business)}, the AI Office Manager for ${spokenBusinessName} — you already introduced yourself as this in your opening line. Never claim or imply you're a human member of staff if asked directly. Never mention "WorkRoute" in any form.

Speak naturally and briefly, warm and low-key — this is a quick follow-up, not a sales pitch. Ask one thing at a time and actually wait for their answer before moving to the next question — never stack two questions into the same turn.

Today is ${todayForPrompt()}. Use this as the real current date when resolving a relative date they give you.

YOU called THEM — ${tradieName} recently gave ${client.name} a quote of $${client.quotedPrice.toFixed(2)} for ${jobDescription}, and you're following up to see if they'd like to go ahead.

- If yes: ask if they'd like to lock in a day/time now. If they give you one, call check_availability, then book_appointment if it's free. If it's not free, offer an alternative or tell them ${tradieName} will call back to sort out a time.
- If they're still deciding: thank them for considering it, don't push, and call flag_for_attention with priority "low" and a short reason so ${tradieName} knows to check back with them himself.
- If they say no, or raise a problem with the quote (too expensive, wrong scope, anything like that): don't negotiate on price yourself — call flag_for_attention with priority "medium" and a short reason, tell them ${tradieName} will be in touch, and end the call politely.

Once the call has reached a natural conclusion either way, end with exactly this sentence, word for word, nothing after it: "${OUTBOUND_END_CALL_PHRASE}"${pronunciationInstructions(business.pronunciationOverrides)}`;
}

export function buildQuoteFollowupAssistantConfig(business: PhoneBusinessContext, client: QuoteFollowupClient) {
  return {
    firstMessage: `${timeOfDayGreeting()}, this is ${resolvePersonaName(business)} from ${applyPronunciationOverrides(business.businessName, business.pronunciationOverrides)} — is this ${client.name}?`,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "anthropic",
      model: MODEL,
      messages: [{ role: "system", content: outboundQuoteFollowupPrompt(business, client) }],
      tools: TOOLS,
    },
    voice: resolveVoice(business),
    endCallPhrases: [OUTBOUND_END_CALL_PHRASE],
    endCallMessage: OUTBOUND_END_CALL_PHRASE,
    transcriber: {
      provider: "deepgram",
      model: "nova-3",
      language: "en-AU",
      smartFormat: true,
      keywords: buildTranscriberKeywords(business.trade, business.serviceArea),
    },
  };
}

export function buildPaymentChaseAssistantConfig(business: PhoneBusinessContext, client: PaymentChaseClient) {
  return {
    firstMessage: `${timeOfDayGreeting()}, this is ${resolvePersonaName(business)} from ${applyPronunciationOverrides(business.businessName, business.pronunciationOverrides)} — is this ${client.name}?`,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "anthropic",
      model: MODEL,
      messages: [{ role: "system", content: outboundPaymentChasePrompt(business, client) }],
      tools: [FLAG_FOR_ATTENTION_TOOL, CONFIRM_INVOICE_PAID_TOOL],
    },
    voice: resolveVoice(business),
    endCallPhrases: [OUTBOUND_END_CALL_PHRASE],
    endCallMessage: OUTBOUND_END_CALL_PHRASE,
    transcriber: {
      provider: "deepgram",
      model: "nova-3",
      language: "en-AU",
      smartFormat: true,
      keywords: buildTranscriberKeywords(business.trade, business.serviceArea),
    },
  };
}

// ---------------------------------------------------------------------
// Tool handlers. Each is only ever reachable from the Vapi tool-calls
// webhook (app/api/vapi/webhook/route.ts), which resolves business_id/
// job_id itself from the call record rather than trusting anything in the
// model's tool input — same rule as lib/messenger-ai.ts.
// ---------------------------------------------------------------------

type CallRecord = { business_id: string; job_id: string | null; matched_client_id: string | null };
export type TradeAnswers = Record<string, string | string[] | boolean | number | undefined>;

async function getCallRecord(supabase: SupabaseClient, vapiCallId: string): Promise<CallRecord | null> {
  const { data } = await supabase
    .from("phone_call_captures")
    .select("business_id, job_id, matched_client_id")
    .eq("vapi_call_id", vapiCallId)
    .maybeSingle();
  return data;
}

// The model doesn't reliably respect a question's declared type over voice —
// e.g. sending "None" instead of ["None"] for a multiselect. computeEstimate
// (lib/trade-pricing.ts) iterates multiselect answers as an array, so a bare
// string would silently iterate character-by-character instead of matching
// the option — wrong, but not an error, which makes it easy to miss. Coerce
// at the boundary instead of trusting the model's shape.
//
// Split into a sync core (needs the trade string, nothing else) plus a thin
// async wrapper that looks it up — callers that already know the trade
// (handleGetPriceEstimate, which fetches it anyway for pricing) can skip a
// redundant business_profiles round trip by calling the sync version
// directly. This used to be a silent duplicate fetch: get_price_estimate
// called this (1 business_profiles read) then recalculateEstimate did its
// own separate one — two reads for the same one piece of data, on the exact
// tool call every real test call has struggled with latency-wise.
export function normalizeTradeAnswersForTrade(trade: string, answers: TradeAnswers): TradeAnswers {
  const questions = TRADE_QUESTIONS[trade] ?? [];
  const normalized: TradeAnswers = { ...answers };
  for (const q of questions) {
    if (q.type !== "multiselect") continue;
    const value = normalized[q.id];
    if (typeof value === "string") normalized[q.id] = [value];
  }
  return normalized;
}

export async function normalizeTradeAnswers(
  supabase: SupabaseClient,
  businessId: string,
  answers: TradeAnswers
): Promise<TradeAnswers> {
  const { data: profile } = await supabase.from("business_profiles").select("trade").eq("user_id", businessId).maybeSingle();
  return normalizeTradeAnswersForTrade(profile?.trade ?? "", answers);
}

// A phone-number match only proves the same number called before, not that
// the same person is on the line — a family member, a new occupant, or a
// recycled number all produce a matched_client_id with a real, different
// caller. Confirmed on a real test call: "John Smith" matched an existing
// client "Mick Johnson" by caller ID, and the job silently inherited Mick's
// old address while showing John's name — a job that looked complete but
// was actually fabricated. Only the first name is compared (not a strict
// full-name match) so minor mishearing of a surname doesn't lose the
// legitimate fast-path for an actual returning customer.
export function namesLikelyMatch(a: string, b: string): boolean {
  const firstWord = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const first = firstWord(a);
  return first.length > 0 && first === firstWord(b);
}

// §wrong-city-geocode — a real incident: a caller's suburb was misheard,
// and Google still matched a real street of that name — just in a
// completely different city (Parramatta NSW instead of Hervey Bay QLD).
// A genuine route match was trusted outright with no check on whether it
// was anywhere near the business's own area. This compares a freshly
// geocoded point against the business's own city (geocoded once at profile
// save — see app/api/profile/geocode-city/route.ts) and returns true only
// when both points exist and are implausibly far apart — never blocks a
// booking on its own, just tells the caller not to fully trust the match.
async function isFarFromServiceArea(
  supabase: SupabaseClient,
  businessId: string,
  lat: number,
  lng: number
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("service_center_lat, service_center_lng")
    .eq("user_id", businessId)
    .maybeSingle();

  if (!profile?.service_center_lat || !profile?.service_center_lng) return false;

  return haversineKm(lat, lng, profile.service_center_lat, profile.service_center_lng) > SERVICE_AREA_SANITY_RADIUS_KM;
}

type UpdateJobDraftInput = {
  customer_name?: string;
  customer_phone?: string;
  address_street?: string;
  address_suburb?: string;
  address_postcode?: string;
  job_label?: string;
  trade_answers?: TradeAnswers;
};

export async function handleUpdateJobDraft(
  supabase: SupabaseClient,
  vapiCallId: string,
  callerNumber: string | null,
  input: UpdateJobDraftInput
): Promise<string> {
  const call = await getCallRecord(supabase, vapiCallId);
  if (!call) return JSON.stringify({ ok: false, error: "Call not found." });

  if (!call.job_id) {
    // Skip the trade lookup entirely when there's nothing to normalize —
    // true for most of the four core answers (name, phone, address), which
    // never touch trade_answers. Every avoided round-trip here is latency
    // the caller is actually sitting through mid-call. These two reads are
    // fully independent of each other, so run them in parallel rather than
    // one-after-another — a real, measured source of the "just a sec"
    // clusters heard on a real test call (2026-09-10), not just a
    // theoretical win.
    const hasTradeAnswers = input.trade_answers && Object.keys(input.trade_answers).length > 0;
    const [normalizedAnswers, matchedClientRecord] = await Promise.all([
      hasTradeAnswers ? normalizeTradeAnswers(supabase, call.business_id, input.trade_answers!) : Promise.resolve({}),
      // A recognized returning client (§25 revision) fills in address gaps
      // the AI didn't need to re-ask for — never overrides what the AI
      // actually heard this call, only fills what's missing.
      call.matched_client_id
        ? supabase
            .from("clients")
            .select("name, address_street, address_suburb, address_postcode")
            .eq("id", call.matched_client_id)
            .maybeSingle()
            .then(({ data }) => data ?? null)
        : Promise.resolve(null),
    ]);

    // Only trust the phone-number match once the caller's own stated name
    // backs it up — see namesLikelyMatch's comment above. If no name has
    // been captured yet, there's nothing to confirm against, so the
    // fast-path is withheld rather than assumed; the caller will just be
    // asked for their address normally like any new customer.
    const callerName = input.customer_name?.trim();
    const clientConfirmed = Boolean(matchedClientRecord && callerName && namesLikelyMatch(callerName, matchedClientRecord.name));
    const knownAddress = clientConfirmed ? matchedClientRecord : null;
    const confirmedClientId = clientConfirmed ? call.matched_client_id : null;

    const rawAddressStreet = input.address_street?.trim() || knownAddress?.address_street || null;
    const rawAddressSuburb = input.address_suburb?.trim() || knownAddress?.address_suburb || null;
    const rawAddressPostcode = input.address_postcode?.trim() || knownAddress?.address_postcode || null;

    // §Google Maps integration — geocode whatever address we've got so far.
    // A successful match replaces the raw (possibly mis-heard) text with
    // Google's canonical spelling and gives us lat/lng for travel-time
    // checking later; a miss just means we don't have coordinates yet,
    // not that the booking is blocked — addressValid in the result lets
    // Sarah know to double-check the street name naturally.
    const hasAddress = rawAddressStreet || rawAddressSuburb;
    const geocoded = hasAddress
      ? await geocodeAddress({
          addressStreet: rawAddressStreet,
          addressSuburb: rawAddressSuburb,
          addressPostcode: rawAddressPostcode,
        })
      : null;
    // §wrong-city-geocode — a real route match in the wrong city (see
    // isFarFromServiceArea's comment) is treated the same as a miss: don't
    // trust the coordinates for routing, and let Sarah's existing
    // addressValid-driven double-check naturally re-confirm the suburb.
    const farFromArea =
      geocoded && (await isFarFromServiceArea(supabase, call.business_id, geocoded.lat, geocoded.lng));

    // §CRM completeness — a brand-new caller (not a confirmed returning
    // client) previously never got a clients row at all: their info lived
    // only on this one job, so they could never be recognized on a future
    // call (findMatchingClient has nothing to match against), and never
    // showed up on the Clients page the way a manually-entered job's
    // customer always has (see job-form.tsx's identical create-then-link
    // pattern, mirrored here). Only creates one once a real name is known —
    // a job_label volunteered before the name is ever given shouldn't spawn
    // a client record with no name.
    let newClientId: string | null = null;
    if (!confirmedClientId && input.customer_name?.trim()) {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({
          business_id: call.business_id,
          name: input.customer_name.trim(),
          phone: input.customer_phone?.trim() || callerNumber || null,
          address_street: geocoded?.addressStreet || rawAddressStreet,
          address_suburb: rawAddressSuburb,
          address_postcode: rawAddressPostcode,
        })
        .select("id")
        .single();
      newClientId = newClient?.id ?? null;
    }

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        business_id: call.business_id,
        client_id: confirmedClientId || newClientId,
        source: "call",
        customer_name: input.customer_name?.trim() || "Caller",
        customer_phone: input.customer_phone?.trim() || callerNumber || null,
        // Only the street text gets replaced with Google's canonical
        // spelling (that's where STT actually mishears things, e.g.
        // "Trees" for "Street") — suburb/postcode stay exactly what the
        // caller said and Sarah confirmed with them, even if Google's
        // boundary data would technically call it something else (a real
        // road can cross a suburb line; overriding what the customer just
        // agreed to would create a new, more confusing mismatch).
        address_street: geocoded?.addressStreet || rawAddressStreet,
        address_suburb: rawAddressSuburb,
        address_postcode: rawAddressPostcode,
        latitude: farFromArea ? null : geocoded?.lat ?? null,
        longitude: farFromArea ? null : geocoded?.lng ?? null,
        job_label: input.job_label?.trim() || null,
        trade_answers: normalizedAnswers,
        confidence: "Low",
        attention_priority: farFromArea ? "medium" : null,
      })
      .select("id")
      .single();

    if (error || !job) {
      console.error("[phone-ai] update_job_draft insert failed:", JSON.stringify(error));
      return JSON.stringify({ ok: false, error: "Couldn't save job details." });
    }

    await supabase.from("phone_call_captures").update({ job_id: job.id }).eq("vapi_call_id", vapiCallId);
    // Pricing is now a silent, tradie-only reference (§25 revision) — no
    // longer read live by the AI, so recalculating it on every single
    // tool call was pure added latency for no live benefit. Runs once,
    // at end-of-call instead (see recalculateEstimate call in
    // app/api/vapi/webhook/route.ts's handleEndOfCallReport).
    return JSON.stringify({ ok: true, ...(hasAddress ? { addressValid: geocoded !== null && !farFromArea } : {}) });
  }

  const patch: Record<string, unknown> = {};
  if (input.customer_name?.trim()) patch.customer_name = input.customer_name.trim();
  if (input.customer_phone?.trim()) patch.customer_phone = input.customer_phone.trim();
  if (input.job_label?.trim()) patch.job_label = input.job_label.trim();

  // Merge, never clobber: a later call with fewer known fields shouldn't
  // erase what an earlier call already captured. Only fetched when there's
  // actually something to merge — most calls don't touch trade_answers.
  if (input.trade_answers && Object.keys(input.trade_answers).length > 0) {
    const [{ data: existing }, normalizedAnswers] = await Promise.all([
      supabase.from("jobs").select("trade_answers").eq("id", call.job_id).maybeSingle(),
      normalizeTradeAnswers(supabase, call.business_id, input.trade_answers),
    ]);
    patch.trade_answers = { ...(existing?.trade_answers ?? {}), ...normalizedAnswers };
  }

  // §Google Maps integration — same geocode-on-capture as the insert path
  // above, but merged against whatever address is already saved first
  // (a caller correcting just the street shouldn't lose an already-known
  // suburb/postcode when we re-geocode the full address).
  let addressValid: boolean | undefined;
  const touchesAddress = input.address_street?.trim() || input.address_suburb?.trim() || input.address_postcode?.trim();
  if (touchesAddress) {
    const { data: existingJob } = await supabase
      .from("jobs")
      .select("address_street, address_suburb, address_postcode")
      .eq("id", call.job_id)
      .maybeSingle();

    const mergedStreet = input.address_street?.trim() || existingJob?.address_street || null;
    const mergedSuburb = input.address_suburb?.trim() || existingJob?.address_suburb || null;
    const mergedPostcode = input.address_postcode?.trim() || existingJob?.address_postcode || null;

    const geocoded = await geocodeAddress({
      addressStreet: mergedStreet,
      addressSuburb: mergedSuburb,
      addressPostcode: mergedPostcode,
    });
    // §wrong-city-geocode — same "real route, wrong city" check as the
    // insert path above.
    const farFromArea =
      geocoded && (await isFarFromServiceArea(supabase, call.business_id, geocoded.lat, geocoded.lng));
    addressValid = geocoded !== null && !farFromArea;
    if (farFromArea) patch.attention_priority = "medium";

    // Same rule as the insert path above — only the street text is ever
    // replaced by Google's canonical version; suburb/postcode stay exactly
    // what the caller said.
    patch.address_street = geocoded?.addressStreet || mergedStreet;
    patch.address_suburb = mergedSuburb;
    patch.address_postcode = mergedPostcode;
    patch.latitude = farFromArea ? null : geocoded?.lat ?? null;
    patch.longitude = farFromArea ? null : geocoded?.lng ?? null;
  }

  // §CRM completeness — mirrors the same create-on-first-name logic in the
  // insert branch above, for the case where the name wasn't known yet when
  // the job was first created (e.g. a job description volunteered before
  // the caller gave their name).
  if (patch.customer_name && !call.matched_client_id) {
    const { data: existingJob } = await supabase
      .from("jobs")
      .select("client_id, customer_phone, address_street, address_suburb, address_postcode")
      .eq("id", call.job_id)
      .maybeSingle();

    if (existingJob && !existingJob.client_id) {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({
          business_id: call.business_id,
          name: patch.customer_name as string,
          phone: (patch.customer_phone as string | undefined) || existingJob.customer_phone || callerNumber || null,
          address_street: (patch.address_street as string | undefined) || existingJob.address_street,
          address_suburb: (patch.address_suburb as string | undefined) || existingJob.address_suburb,
          address_postcode: (patch.address_postcode as string | undefined) || existingJob.address_postcode,
        })
        .select("id")
        .single();
      if (newClient) patch.client_id = newClient.id;
    }
  }

  if (Object.keys(patch).length > 0) {
    await supabase.from("jobs").update(patch).eq("id", call.job_id);
  }

  return JSON.stringify({ ok: true, ...(addressValid !== undefined ? { addressValid } : {}) });
}

type AvailabilityInput = { date?: string; time?: string; block?: "Morning" | "Afternoon" | "Evening" };
type BookAppointmentInput = AvailabilityInput & { recurring?: RecurringFrequency };

export async function handleCheckAvailability(
  supabase: SupabaseClient,
  vapiCallId: string,
  input: AvailabilityInput
): Promise<string> {
  const call = await getCallRecord(supabase, vapiCallId);
  if (!call?.job_id || !input.date) {
    return JSON.stringify({ available: false, error: "No date given, or no job captured yet." });
  }

  const result = await checkAvailability(supabase, call.business_id, call.job_id, {
    date: input.date,
    time: input.time ?? null,
    block: input.block ?? null,
  });
  return JSON.stringify(result);
}

// §25 — books a real date/time for the job, whether that ends up being a
// quote visit or the job itself. Reuses checkAvailability/rescheduleJob
// (lib/messenger-scheduling.ts) rather than a second scheduling algorithm —
// same reasoning as that file's own header comment. quoteRequired is
// (re)computed here, right before booking, from whatever trade_answers the
// caller volunteered — the AI never decides this itself (§25/§31's
// "AI interprets, code decides" split); it only relays whichever way the
// tool result comes back. Both outcomes book an identical time slot — the
// only difference is the quote_required flag and how the AI is told to
// phrase the confirmation.
export async function handleBookAppointment(
  supabase: SupabaseClient,
  vapiCallId: string,
  appOrigin: string,
  input: BookAppointmentInput
): Promise<string> {
  const call = await getCallRecord(supabase, vapiCallId);
  if (!call?.job_id || !input.date) {
    return JSON.stringify({ ok: false, error: "No date given, or no job captured yet." });
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("trade, first_name, business_name")
    .eq("user_id", call.business_id)
    .maybeSingle();
  if (!profile) return JSON.stringify({ ok: false, error: "Business not found." });

  await recalculateEstimate(supabase, call.business_id, call.job_id);

  const { data: job } = await supabase
    .from("jobs")
    .select("quote_required, customer_name, customer_phone, customer_access_token")
    .eq("id", call.job_id)
    .maybeSingle();
  if (!job) return JSON.stringify({ ok: false, error: "Job not found." });

  await rescheduleJob(supabase, call.job_id, call.business_id, {
    date: input.date,
    time: input.time ?? null,
    block: input.block ?? null,
  });
  // rescheduleJob deliberately leaves status untouched (it's built for
  // moving an already-scheduled job) — this is this job's first-ever
  // booking, so it needs the same Unscheduled → Scheduled transition the
  // run sheet's own manual "Schedule" action makes (run-sheet-board.tsx).
  await supabase.from("jobs").update({ status: "Scheduled" }).eq("id", call.job_id);

  // Same one-way booking-confirmed SMS every other first-time scheduling
  // path sends (run-sheet-board.tsx's handleScheduleSave) — kept identical
  // so a phone booking looks no different to the customer than a
  // manually-scheduled one. §appointment-detail-fix — a real call caught
  // this SMS-only version never actually writing the appointment detail
  // anywhere the customer could read it, same gap already fixed on the
  // Run Sheet's own scheduling path (/api/notify) — this is the phone AI's
  // own separate booking path and needed the identical fix applied here too.
  if (job.customer_phone) {
    const messengerLink = `${appOrigin}/m/${job.customer_access_token}`;
    const appointmentLabel = formatAppointmentLabel(input.date, input.time ?? null, input.block ?? null);
    const message = messageFor(
      "booking_confirmed",
      job.customer_name,
      profile.first_name,
      profile.business_name,
      messengerLink,
      null,
      null,
      null,
      appointmentLabel
    );
    await sendSms(job.customer_phone, message);
    await supabase.from("messages").insert({
      job_id: call.job_id,
      business_id: call.business_id,
      sender: "ai",
      body: `Your appointment is confirmed for ${appointmentLabel}.`,
    });
  }

  // §recurring — only for a genuinely ongoing/regular service (the caller
  // said so and gave a frequency), not every booking. Runs after the first
  // visit's own booking/SMS above, and never fails the call if it has
  // trouble — the first visit is already safely booked either way.
  let recurringResult: { occurrencesBooked: number; occurrencesSkipped: number } | null = null;
  if (input.recurring) {
    try {
      const series = await createRecurringSeries(
        supabase,
        call.business_id,
        call.job_id,
        input.date,
        input.time ?? null,
        input.block ?? null,
        input.recurring
      );
      if (series) {
        recurringResult = { occurrencesBooked: series.createdDates.length, occurrencesSkipped: series.skippedDates.length };
      }
    } catch (error) {
      console.error("[phone-ai] createRecurringSeries failed —", error);
    }
  }

  return JSON.stringify({ ok: true, quoteRequired: job.quote_required, recurring: recurringResult });
}

// §phone-AI-depth — the AI's only way to learn a real price mid-call.
// Deliberately inlined rather than reusing recalculateEstimate (below,
// still used by handleBookAppointment and the end-of-call report, where
// latency doesn't matter the same way) — this is the single most
// latency-sensitive tool call in the whole phone AI, the one every real test
// call on 2026-09-10 stalled or hung at, so every avoidable round trip
// (including two separate redundant business_profiles.trade reads and two
// separate trade_answers reads/writes the original version had) has been
// collapsed into exactly one parallel read, one pricing-config read, and one
// combined write. Still the same "AI interprets, code decides" split as
// everywhere else — the model supplies trade_answers, this is purely a
// deterministic read of computeEstimate's result, never the model's own
// arithmetic.
export async function handleGetPriceEstimate(
  supabase: SupabaseClient,
  vapiCallId: string,
  input: { trade_answers?: TradeAnswers } = {}
): Promise<string> {
  const call = await getCallRecord(supabase, vapiCallId);
  if (!call?.job_id) return JSON.stringify({ ok: false, error: "No job captured yet." });

  const [{ data: profile }, { data: job }] = await Promise.all([
    supabase.from("business_profiles").select("trade").eq("user_id", call.business_id).maybeSingle(),
    supabase.from("jobs").select("trade_answers").eq("id", call.job_id).maybeSingle(),
  ]);
  if (!profile || !job) return JSON.stringify({ ok: false, error: "Job not found." });

  let tradeAnswers: TradeAnswers = job.trade_answers ?? {};
  if (input.trade_answers && Object.keys(input.trade_answers).length > 0) {
    tradeAnswers = { ...tradeAnswers, ...normalizeTradeAnswersForTrade(profile.trade, input.trade_answers) };
  }

  const pricing = await loadTradePricingConfig(supabase, call.business_id, profile.trade);
  if (!pricing) {
    await supabase.from("jobs").update({ trade_answers: tradeAnswers, quote_required: true }).eq("id", call.job_id);
    return JSON.stringify({ quoteRequired: true });
  }

  const result = computeEstimate(tradeAnswers, pricing);
  await supabase
    .from("jobs")
    .update(
      result.quoteRequired
        ? { trade_answers: tradeAnswers, quote_required: true }
        : {
            trade_answers: tradeAnswers,
            quote_required: false,
            estimated_price: result.price,
            estimated_duration_minutes: result.durationMinutes,
          }
    )
    .eq("id", call.job_id);

  return JSON.stringify(result);
}

// §38 — only reachable on an outbound reactivation call (mark_do_not_call
// isn't in the inbound tool set), where matched_client_id is always set
// before the call even starts. Sets do_not_call directly rather than going
// through flag_for_attention — this needs to take effect immediately, not
// wait for the tradie to notice a flagged call later.
export async function handleMarkDoNotCall(supabase: SupabaseClient, vapiCallId: string): Promise<string> {
  const call = await getCallRecord(supabase, vapiCallId);
  if (!call?.matched_client_id) return JSON.stringify({ ok: false, error: "No client on this call." });

  await supabase.from("clients").update({ do_not_call: true }).eq("id", call.matched_client_id);
  return JSON.stringify({ ok: true });
}

// §Invoice chase — job_id is already known on this call (set at
// placement time, see lib/invoice-chase.ts), unlike a fresh reactivation
// call which only creates one once a booking actually happens.
export async function handleConfirmInvoicePaid(
  supabase: SupabaseClient,
  vapiCallId: string,
  input: { paid?: boolean }
): Promise<string> {
  const call = await getCallRecord(supabase, vapiCallId);
  if (!call?.job_id) return JSON.stringify({ ok: false, error: "No job on this call." });

  if (input.paid) {
    await supabase.from("jobs").update({ invoice_paid_at: new Date().toISOString() }).eq("id", call.job_id);
  }
  return JSON.stringify({ ok: true });
}

// Deterministic pricing (§26/§31) — reads only what's already persisted on
// the job, never what the model claims it heard. Runs silently in the
// background purely for the tradie's reference now (§25 revision — the AI
// no longer chases or speaks a price live on the call). Returns
// quoteRequired:true whenever this business hasn't configured rates for its
// trade, which is exactly §34b's "genuinely quotable vs. always Quote
// Required" split in practice.
export async function recalculateEstimate(
  supabase: SupabaseClient,
  businessId: string,
  jobId: string
): Promise<EstimateResult | null> {
  // These two reads are independent — parallelizing them (rather than the
  // original sequential profile-then-job order) is a real, measured latency
  // cut on the one tool call that's now on the hot path of every phone call
  // (get_price_estimate), not a theoretical optimization.
  const [{ data: profile }, { data: job }] = await Promise.all([
    supabase.from("business_profiles").select("trade").eq("user_id", businessId).maybeSingle(),
    supabase.from("jobs").select("trade_answers").eq("id", jobId).maybeSingle(),
  ]);
  if (!profile || !job) return null;

  const pricing = await loadTradePricingConfig(supabase, businessId, profile.trade);
  if (!pricing) {
    await supabase.from("jobs").update({ quote_required: true }).eq("id", jobId);
    return { quoteRequired: true };
  }

  const result = computeEstimate(job.trade_answers ?? {}, pricing);
  if (result.quoteRequired) {
    await supabase.from("jobs").update({ quote_required: true }).eq("id", jobId);
  } else {
    await supabase
      .from("jobs")
      .update({
        quote_required: false,
        estimated_price: result.price,
        estimated_duration_minutes: result.durationMinutes,
      })
      .eq("id", jobId);
  }

  return result;
}

export async function handleFlagForAttention(
  supabase: SupabaseClient,
  vapiCallId: string,
  appOrigin: string,
  input: { priority?: "low" | "medium" | "high"; reason?: string }
): Promise<string> {
  // The model's own tool schema marks priority as required, but a real
  // call showed it can still arrive missing — defaulting instead of
  // silently no-oping means a genuine "something needs attention" signal
  // never gets lost just because the model skipped a field.
  const priority = input.priority ?? "low";

  const call = await getCallRecord(supabase, vapiCallId);
  if (!call) return JSON.stringify({ ok: false });

  let jobId: string;
  if (call.job_id) {
    jobId = call.job_id;
  } else {
    // A call worth flagging is worth a record, even if the AI hasn't
    // learned the caller's name yet.
    const { data: newJob, error } = await supabase
      .from("jobs")
      .insert({ business_id: call.business_id, client_id: call.matched_client_id, source: "call", customer_name: "Caller", confidence: "Low" })
      .select("id")
      .single();
    if (error || !newJob) {
      console.error("[phone-ai] flag_for_attention job insert failed:", JSON.stringify(error));
      return JSON.stringify({ ok: false });
    }
    jobId = newJob.id;
    await supabase.from("phone_call_captures").update({ job_id: jobId }).eq("vapi_call_id", vapiCallId);
  }

  const { data: job } = await supabase.from("jobs").select("customer_name").eq("id", jobId).maybeSingle();

  await supabase.from("jobs").update({ attention_priority: priority }).eq("id", jobId);

  // Reuses the exact Needs Attention inbox the Messenger already built
  // (§24/§32) — a "messages" row is what makes this job show up there,
  // same as an AI-authored Messenger reply would.
  await supabase.from("messages").insert({
    job_id: jobId,
    business_id: call.business_id,
    sender: "ai",
    body: `Phone intake needs your attention${input.reason ? ` — ${input.reason}` : "."} See the call transcript on this job for the full context.`,
    visible_to_customer: false,
  });

  if (priority === "high") {
    await notifyOwnerHighPriority(supabase, call.business_id, job?.customer_name ?? "A caller", jobId, appOrigin);

    const { data: profile } = await supabase
      .from("business_profiles")
      .select("phone")
      .eq("user_id", call.business_id)
      .maybeSingle();
    if (profile?.phone) {
      await sendSms(profile.phone, `WorkRoute: ${job?.customer_name ?? "A caller"} needs you urgently — check ${appOrigin}/app/jobs/${jobId}`);
    }
  }

  return JSON.stringify({ ok: true });
}

// Called once, at end-of-call — upgrades the "Low" confidence set when the
// job draft was first created to something that actually reflects how much
// was captured, same purpose as the tradie's own Job Confidence picker on
// the manual capture form (jobs/new/job-form.tsx).
export async function finalizeCallConfidence(supabase: SupabaseClient, jobId: string, trade: string): Promise<void> {
  const { data: job } = await supabase.from("jobs").select("trade_answers, customer_phone").eq("id", jobId).maybeSingle();
  if (!job) return;

  const questions = TRADE_QUESTIONS[trade] ?? [];
  const answered = questions.filter((q) => {
    const v = (job.trade_answers as TradeAnswers | null)?.[q.id];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;

  const completeness = questions.length > 0 ? answered / questions.length : 0;
  const confidence =
    completeness >= 0.8 && job.customer_phone ? "High" : completeness > 0 || job.customer_phone ? "Medium" : "Low";

  await supabase.from("jobs").update({ confidence }).eq("id", jobId);
}

// Called once, at end-of-call, when a job was captured but never flagged —
// the normal completion path now that the AI hands every new enquiry to the
// tradie by default (§25 revision), distinct from flag_for_attention's
// urgent/exceptional escalation. Skipped if attention_priority is already
// set, so a flagged call doesn't fire two notifications.
export async function notifyNewPhoneJob(
  supabase: SupabaseClient,
  businessId: string,
  jobId: string,
  appOrigin: string
): Promise<void> {
  const { data: job } = await supabase
    .from("jobs")
    .select("customer_name, job_label, attention_priority, scheduled_date, quote_required")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.attention_priority) return;

  // §25 — book_appointment may already have booked a time during the call;
  // that's a materially different heads-up than "call them back to arrange
  // one," so it gets its own wording rather than reusing the unscheduled
  // enquiry message below for both cases.
  if (job.scheduled_date) {
    const visitType = job.quote_required ? "quote visit" : "job";
    const displayDate = new Date(`${job.scheduled_date}T00:00:00`).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    await supabase.from("messages").insert({
      job_id: jobId,
      business_id: businessId,
      sender: "ai",
      body: `Phone booking — ${visitType} scheduled for ${displayDate} (${job.job_label || "see job details"}). Give ${job.customer_name} a call beforehand to confirm details.`,
      visible_to_customer: false,
    });
    await notifyOwnerPhoneBooking(supabase, businessId, job.customer_name, jobId, appOrigin, job.quote_required);
    return;
  }

  await supabase.from("messages").insert({
    job_id: jobId,
    business_id: businessId,
    sender: "ai",
    body: `New phone enquiry captured — ${job.job_label || "see job details"}. Give ${job.customer_name} a call to confirm and quote.`,
    visible_to_customer: false,
  });

  await notifyOwnerNewPhoneEnquiry(supabase, businessId, job.customer_name, jobId, appOrigin);
}
