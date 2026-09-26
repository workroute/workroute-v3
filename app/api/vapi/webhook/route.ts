import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildAssistantConfig,
  buildTrialExpiredAssistantConfig,
  handleUpdateJobDraft,
  handleFlagForAttention,
  handleCheckAvailability,
  handleBookAppointment,
  handleGetPriceEstimate,
  handleMarkDoNotCall,
  handleConfirmInvoicePaid,
  finalizeCallConfidence,
  recalculateEstimate,
  notifyNewPhoneJob,
  isVoiceFailure,
  type PhoneBusinessContext,
} from "@/lib/phone-ai";
import { loadTradePricingConfig } from "@/lib/trade-pricing";
import { notifyOwnerVoiceFailure, notifyAdminOfTrialLimit, notifyTradieApproachingTrialLimit } from "@/lib/push-notifications";
import { checkAndAlertVip } from "@/lib/vip-alerts";
import { findMatchingClient } from "@/lib/returning-client";
import { resolveQuoteFollowupCallOutcome } from "@/lib/quote-followup";
import type { SupabaseClient } from "@supabase/supabase-js";

// §25 — the single Server URL every event for the WorkRoute Vapi phone
// number(s) hits. Vapi distinguishes event types via body.message.type; see
// lib/phone-ai.ts for the assistant config / tool schemas / tool handlers
// this dispatches into. No authenticated session is ever available here —
// the caller is Vapi's infrastructure, not a signed-in tradie — so every
// business/job lookup below is resolved from the call record itself
// (phoneNumberId → business, vapi_call_id → phone_call_captures → job),
// never trusted from request input directly.
export async function POST(request: Request) {
  const secret = request.headers.get("x-vapi-secret");
  const secretOk = !!process.env.VAPI_WEBHOOK_SECRET && secret === process.env.VAPI_WEBHOOK_SECRET;
  if (!secretOk) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const message = body?.message;
  if (!message?.type) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceRoleClient();
  const appOrigin = new URL(request.url).origin;

  switch (message.type) {
    case "assistant-request":
      return handleAssistantRequest(supabase, message, appOrigin);
    case "tool-calls":
      return handleToolCalls(supabase, message, appOrigin);
    case "end-of-call-report":
      await handleEndOfCallReport(supabase, message, appOrigin);
      return NextResponse.json({ ok: true });
    default:
      // status-update and anything else Vapi adds later — no response body
      // is required for these per Vapi's docs.
      return NextResponse.json({ ok: true });
  }
}

async function handleAssistantRequest(supabase: SupabaseClient, message: any, appOrigin: string) {
  const call = message.call ?? {};
  const phoneNumberId: string | undefined = call.phoneNumberId;
  const callerNumber: string | undefined = call.customer?.number;
  const callId: string | undefined = call.id;

  if (!phoneNumberId || !callId) {
    console.log("[vapi-webhook] assistant-request missing phoneNumberId/callId:", JSON.stringify(call));
    return NextResponse.json({ error: "Missing call details." });
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select(
      "user_id, business_name, trade, first_name, service_area, ai_voice_id, ai_persona_name, starting_price, created_at, is_paying, trial_limit_notified_at, trial_warning_sent_at"
    )
    .eq("vapi_phone_number_id", phoneNumberId)
    .maybeSingle();

  if (!profile) {
    console.log("[vapi-webhook] no business matched phoneNumberId:", phoneNumberId);
    return NextResponse.json({ error: "This number isn't connected to a WorkRoute business yet." });
  }

  const business: PhoneBusinessContext = {
    businessId: profile.user_id,
    businessName: profile.business_name,
    trade: profile.trade,
    firstName: profile.first_name,
    serviceArea: profile.service_area,
    voiceId: profile.ai_voice_id,
    personaName: profile.ai_persona_name,
    startingPrice: profile.starting_price,
  };

  // §trial-limits — 14 days or 150 calls, whichever comes first, unless
  // is_paying has been flipped manually (Owner Overview page — there's no
  // automated payment webhook yet). Checked before any of the normal
  // call-setup work below, since an over-limit business shouldn't pay the
  // cost of a real findMatchingClient/checkAndAlertVip round trip either.
  //
  // A warning fires first, well before the hard cutoff — a tradie silently
  // losing real calls with zero notice reflects badly on them and on
  // WorkRoute (real feedback: "they might lose calls and we look bad").
  if (!profile.is_paying) {
    const TRIAL_DAYS = 14;
    const TRIAL_CALL_CAP = 150;
    const TRIAL_WARNING_DAYS_LEFT = 3;
    const TRIAL_WARNING_CALLS_LEFT = 50;

    const daysSinceSignup = (Date.now() - new Date(profile.created_at).getTime()) / 86400000;
    const { count: callCount } = await supabase
      .from("phone_call_captures")
      .select("*", { count: "exact", head: true })
      .eq("business_id", profile.user_id);
    const callsUsed = callCount ?? 0;

    if (daysSinceSignup > TRIAL_DAYS || callsUsed >= TRIAL_CALL_CAP) {
      if (!profile.trial_limit_notified_at) {
        await notifyAdminOfTrialLimit(supabase, profile.business_name, appOrigin);
        await supabase
          .from("business_profiles")
          .update({ trial_limit_notified_at: new Date().toISOString() })
          .eq("user_id", profile.user_id);
      }
      return NextResponse.json({ assistant: buildTrialExpiredAssistantConfig(business) });
    }

    const approachingLimit =
      daysSinceSignup >= TRIAL_DAYS - TRIAL_WARNING_DAYS_LEFT || callsUsed >= TRIAL_CALL_CAP - TRIAL_WARNING_CALLS_LEFT;
    if (approachingLimit && !profile.trial_warning_sent_at) {
      const reason = daysSinceSignup >= TRIAL_DAYS - TRIAL_WARNING_DAYS_LEFT ? "days" : "calls";
      await notifyTradieApproachingTrialLimit(supabase, profile.user_id, appOrigin, reason);
      await supabase
        .from("business_profiles")
        .update({ trial_warning_sent_at: new Date().toISOString() })
        .eq("user_id", profile.user_id);
    }
  }

  // Best-effort — the call must still be answered by the AI even if the
  // capture row, VIP check, or client match hits a problem. findMatchingClient
  // and checkAndAlertVip don't depend on each other, so they run in parallel
  // rather than one-after-another — this was previously three sequential DB
  // round trips before Vapi could even start the greeting, which is real,
  // caller-audible silence on every single call (confirmed on a real test
  // call: it read as "the AI won't answer until I speak"). The capture
  // upsert still has to wait for matchedClient's id, so it stays after —
  // but that's now the only remaining sequential step, not three.
  let matchedClient = null;
  try {
    const [client] = await Promise.all([
      findMatchingClient(supabase, profile.user_id, callerNumber),
      checkAndAlertVip(supabase, profile.user_id, callerNumber),
    ]);
    matchedClient = client;
    await supabase.from("phone_call_captures").upsert(
      {
        business_id: profile.user_id,
        vapi_call_id: callId,
        caller_number: callerNumber ?? null,
        matched_client_id: matchedClient?.id ?? null,
      },
      { onConflict: "vapi_call_id", ignoreDuplicates: true }
    );
  } catch (error) {
    console.error("[vapi-webhook] assistant-request setup failed —", error);
  }

  // §phone-AI-depth — only the question ids this business actually has
  // wired into pricing get asked live on the call (see systemPrompt in
  // lib/phone-ai.ts for why: asking the full generic question set regardless
  // of whether it affects price is what made an earlier version slow).
  const pricing = await loadTradePricingConfig(supabase, profile.user_id, profile.trade);
  const pricingQuestionIds = pricing ? Object.keys(pricing.questions) : [];

  return NextResponse.json({ assistant: buildAssistantConfig(business, matchedClient, pricingQuestionIds) });
}

// Vapi's real "tool-calls" payload nests the tool name/arguments under
// call.function.{name,arguments} (confirmed against a live production
// transcript, not just docs) — NOT top-level call.name/call.parameters,
// which this dispatch was reading until now. That mismatch meant every
// single tool call, on every call, was silently resolving call.name to
// undefined and falling into the "Unknown tool" branch below — the model
// was getting a real {ok:false} error back for every single thing it tried
// to do, all night, regardless of which model or how much DB round-trip
// latency was cut. That's the actual root cause behind the stalling,
// "technical trouble," and (worst of all) the one call where the model gave
// up being honest about it and just fabricated a plausible-sounding price
// and booking on top of nothing but failed tool calls. `arguments` can
// arrive either as a parsed object or a JSON string depending on the
// call — handle both rather than assume.
function parseToolArguments(raw: unknown): any {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

async function handleToolCalls(supabase: SupabaseClient, message: any, appOrigin: string) {
  const vapiCallId: string | undefined = message.call?.id;
  const callerNumber: string | null = message.call?.customer?.number ?? null;
  const toolCalls: { id: string; function?: { name: string; arguments: unknown } }[] = message.toolCallList ?? [];

  if (!vapiCallId) {
    return NextResponse.json({ results: [] });
  }

  const results = await Promise.all(
    toolCalls.map(async (call) => {
      const name = call.function?.name;
      const parameters = parseToolArguments(call.function?.arguments);

      let result: string;
      try {
        if (name === "update_job_draft") {
          result = await handleUpdateJobDraft(supabase, vapiCallId, callerNumber, parameters);
        } else if (name === "flag_for_attention") {
          result = await handleFlagForAttention(supabase, vapiCallId, appOrigin, parameters);
        } else if (name === "check_availability") {
          result = await handleCheckAvailability(supabase, vapiCallId, parameters);
        } else if (name === "book_appointment") {
          result = await handleBookAppointment(supabase, vapiCallId, appOrigin, parameters);
        } else if (name === "get_price_estimate") {
          result = await handleGetPriceEstimate(supabase, vapiCallId, parameters);
        } else if (name === "mark_do_not_call") {
          result = await handleMarkDoNotCall(supabase, vapiCallId);
        } else if (name === "confirm_invoice_paid") {
          result = await handleConfirmInvoicePaid(supabase, vapiCallId, parameters);
        } else {
          result = JSON.stringify({ ok: false, error: `Unknown tool: ${name}` });
        }
      } catch (error) {
        console.error(`[vapi-webhook] tool ${name} threw —`, error);
        result = JSON.stringify({ ok: false, error: "Internal error." });
      }
      return { name, toolCallId: call.id, result };
    })
  );

  return NextResponse.json({ results });
}

async function handleEndOfCallReport(supabase: SupabaseClient, message: any, appOrigin: string): Promise<void> {
  const vapiCallId: string | undefined = message.call?.id;
  if (!vapiCallId) return;

  const { data: capture } = await supabase
    .from("phone_call_captures")
    .select("business_id, job_id, status, call_purpose")
    .eq("vapi_call_id", vapiCallId)
    .maybeSingle();
  if (!capture) return;

  // §duplicate-webhook-fix — Vapi can (and did, confirmed on a real call)
  // deliver the same end-of-call-report more than once. Everything below is
  // written to run exactly once per call — a second delivery re-running it
  // means a duplicate push notification and a wasted recalculation, not
  // anything actually wrong, but there's no reason to let it happen twice.
  if (capture.status === "completed") return;

  await supabase
    .from("phone_call_captures")
    .update({
      status: "completed",
      ended_reason: message.endedReason ?? null,
      transcript_text: message.artifact?.transcript ?? null,
      transcript_messages: message.artifact?.messages ?? [],
      ended_at: new Date().toISOString(),
    })
    .eq("vapi_call_id", vapiCallId);

  // §25 — a broken voice ID doesn't error, it just goes dead-air (see
  // isVoiceFailure's comment in lib/phone-ai.ts) — surface it loudly here
  // rather than let the call quietly complete as if it went fine.
  if (isVoiceFailure(message.endedReason)) {
    console.error(`[vapi-webhook] voice failure on call ${vapiCallId} — endedReason: ${message.endedReason}`);
    await notifyOwnerVoiceFailure(supabase, capture.business_id, appOrigin);
  }

  if (!capture.job_id) return;

  // §quote-followup — a distinct post-call path: this job's price/status
  // were already settled before this call was placed, so the generic
  // "new phone enquiry" handling below doesn't apply.
  if (capture.call_purpose === "quote_followup") {
    await resolveQuoteFollowupCallOutcome(supabase, capture.job_id, capture.business_id, message.endedReason ?? null);
    return;
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("trade")
    .eq("user_id", capture.business_id)
    .maybeSingle();
  if (profile) {
    await finalizeCallConfidence(supabase, capture.job_id, profile.trade);
  }

  // Moved here from every update_job_draft call (§25 latency fix) — pricing
  // is a silent, tradie-only reference now, so it only needs to be correct
  // once the call is over, not live during it.
  await recalculateEstimate(supabase, capture.business_id, capture.job_id);

  // §25 revision — the normal "here's a new lead" notification for every
  // captured enquiry, skipped internally if flag_for_attention already
  // flagged this job during the call (see notifyNewPhoneJob).
  await notifyNewPhoneJob(supabase, capture.business_id, capture.job_id, appOrigin);
}
