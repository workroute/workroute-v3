import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "./mobile-message";
import { notifyOwnerHighPriority } from "./push-notifications";
import { checkAvailability, rescheduleJob } from "./messenger-scheduling";
import { recalculateEstimate, normalizeTradeAnswers, namesLikelyMatch, type TradeAnswers } from "./phone-ai";
import { messageFor } from "./notifications";
import { describeQuestionsForPrompt } from "./trade-questions";
import { findMatchingClient } from "./returning-client";

// §Website Widget — the AI agent that replies in the embeddable website
// chat widget. Same "AI interprets, deterministic code decides" split as
// Messenger (lib/messenger-ai.ts) and the phone AI (lib/phone-ai.ts), and
// structurally closest to Messenger — one synchronous request/response per
// visitor turn, no separate webhook event types to dispatch across (unlike
// Vapi's assistant-request/tool-calls/end-of-call-report split). Server-only:
// reads ANTHROPIC_API_KEY from process.env directly, never import from a
// "use client" component.

export type WidgetBusinessContext = {
  businessId: string;
  businessName: string;
  firstName: string | null;
  trade: string;
};

export type WidgetHistoryItem = { sender: "visitor" | "ai"; body: string };

export type WidgetAiResult =
  | { ok: true; reply: string; priority: "low" | "medium" | "high" | null; jobId: string | null }
  | { ok: false };

// claude-sonnet-5, not Haiku — Haiku was tried first for the same cost
// reasons lib/phone-ai.ts's own revision cites, but a real test here
// uncovered a deterministic Haiku-specific bug: after any tool_use +
// tool_result round-trip, its very next response comes back with
// completely empty content (stop_reason "end_turn", zero content blocks) —
// reproduced 100% of the time with this exact prompt/tool shape. The
// identical message sequence works fine on Sonnet, which is why Messenger
// (lib/messenger-ai.ts) already uses it successfully. Cost is real but
// reliability matters more than the saving here — worth retrying Haiku
// later only if this gets independently confirmed fixed upstream.
const MODEL = "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 4;
// Same budget as Messenger/phone-ai — this model can spend max_tokens on an
// extended-thinking block before ever writing the reply, so too tight a
// number here risks losing the actual text.
const MAX_TOKENS = 1024;

// No per-business timezone field exists yet (matches lib/phone-ai.ts's own
// note on this) — Australia/Brisbane (no daylight saving) is a reasonable
// single-region default for now.
function todayForPrompt(): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Australia/Brisbane",
  }).format(new Date());
}

function systemPrompt(business: WidgetBusinessContext): string {
  const tradieName = business.firstName ?? "the team";
  const questionDescriptions = describeQuestionsForPrompt(business.trade);

  return `You are Sarah, the AI Office Manager for ${business.businessName} — chatting with a visitor on ${business.businessName}'s own website. Never mention "WorkRoute" in any form; you work for ${business.businessName}, not a platform. If asked directly whether you're an AI, don't deny it — but don't lead with it either.

Today is ${todayForPrompt()}. Use this as the real current date when the visitor gives a relative or partial date ("this week," "next Tuesday," "the 10th") — resolve it to the correct upcoming date yourself before calling check_availability/book_appointment, never guess a year from anything else.

Reply naturally and briefly, like a text message — a sentence or two, not a paragraph.

First, capture a new enquiry: their full name (first and last — if they only give a first name, ask for their last name too, so two customers with the same first name never get confused later), a phone number to reach them on, and a brief description of what they need. Visitors often describe the job before you ask anything — acknowledge that first, then ask for whichever of the three you're still missing, one at a time. Call capture_lead after each new answer — don't wait until you have all three. If they leave mid-conversation, whatever's been saved so far is still useful.

If the visitor mentions extra specifics unprompted (e.g. "it's a small backyard," "quite overgrown"), pass those along too in trade_answers, matched to whichever of these questions they're actually describing: ${questionDescriptions}. Use the value strings exactly as given — don't paraphrase or invent a close-sounding one, since anything that doesn't match exactly is silently ignored for pricing. If what they said doesn't clearly match one of the listed values, leave it out rather than guess. This is a bonus for ${tradieName}'s reference, never something to ask for — most visitors won't volunteer this level of detail, and that's completely fine.

Once you have those three, ask if they'd like to lock in a day/time now rather than wait for a callback. If they give you one:
- Call check_availability with that date and either a time or a Morning/Afternoon/Evening block.
- If it's free, call book_appointment with the same date/time/block. The result tells you whether this became a "quote visit" or a job booking — if quoteRequired is true, tell them you've booked in a time for ${tradieName} to come out and quote it; if false, tell them you've booked them in, and ${tradieName} will still be in touch to confirm details. Never state a dollar figure either way.
- If it's not free, say so and ask for a different day/time — try up to twice more.
- If they only gave you a block (Morning/Afternoon/Evening), not a specific time, the result may come back with \`suggestedTimes\` instead — real times within that block already confirmed free. Offer two or three of them naturally ("I could do 1, 3, or 4:30 — which suits?") and once they pick one, call book_appointment directly with that exact time, no need to check again. An empty list means genuinely nothing free in that block — ask for a different block or day.
- If nothing works out, or they don't want to commit to a time in the chat, that's fine — just let them know ${tradieName} will be in touch to sort out a time.

Never state a price yourself — only book_appointment's result tells you what to say about booking, and even then, never a dollar figure.

Call flag_for_attention (priority "low", "medium", or "high") any time something needs ${tradieName}'s judgement rather than yours — an unusual request, a complaint, anything time-sensitive, or the visitor explicitly asking to speak to a person. Use "high" only for something genuinely urgent (an emergency or a visitor who needs a human right now). Still reply warmly either way.

Once you've either booked a time or let them know ${tradieName} will call back, thank them. Don't drag the conversation out past that.`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "capture_lead",
    description:
      "Save what's been learned about this enquiry so far. Call this as soon as you know any of the three details, and again every time you learn something new — the lead builds up live during the conversation.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The visitor's full name — first and last, not just a first name" },
        phone: { type: "string", description: "A callback number" },
        job_description: { type: "string", description: "A brief description of what they need help with" },
        trade_answers: {
          type: "object",
          description: "Only include this if the visitor volunteered specifics unprompted — never ask questions just to fill it in.",
        },
      },
    },
  },
  {
    name: "flag_for_attention",
    description: "Flag this conversation for the tradie's attention because something needs their judgement, not yours.",
    input_schema: {
      type: "object",
      properties: {
        priority: { type: "string", enum: ["low", "medium", "high"] },
        reason: { type: "string", description: "One short sentence on why this needs attention" },
      },
      required: ["priority"],
    },
  },
  {
    name: "check_availability",
    description:
      "Check whether a specific date and time (or time-of-day block) is free on the tradie's schedule, before offering it to the visitor. Always call this before book_appointment. For a block only (no specific time), the result comes back with suggestedTimes — real, already-confirmed-free times within that block to offer the visitor directly.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM in 24-hour time, if the visitor wants a specific time" },
        block: { type: "string", enum: ["Morning", "Afternoon", "Evening"], description: "If the visitor wants a time-of-day block instead of a specific time" },
      },
      required: ["date"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Lock in a date/time for this enquiry. Only call this immediately after check_availability confirms the slot is free. Tells you back whether this became a quote visit or a job booking — use that to phrase your confirmation to the visitor. Requires capture_lead to have been called at least once first.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM in 24-hour time" },
        block: { type: "string", enum: ["Morning", "Afternoon", "Evening"] },
      },
      required: ["date"],
    },
  },
];

type CaptureLeadInput = { name?: string; phone?: string; job_description?: string; trade_answers?: TradeAnswers };

// job_id lives on widget_chat_captures, keyed by session_id — same shape as
// phone_call_captures.job_id in lib/phone-ai.ts. Mutated across tool calls
// within one request (first capture_lead call inserts, later ones patch)
// and persisted back to the row so a later HTTP request for the same
// session_id picks up where this one left off. trade_answers handling
// (normalize + merge-not-clobber) mirrors handleUpdateJobDraft in
// lib/phone-ai.ts exactly — reuses normalizeTradeAnswers from there rather
// than duplicating the multiselect-coercion logic.
async function handleCaptureLead(
  supabase: SupabaseClient,
  businessId: string,
  sessionId: string,
  currentJobId: string | null,
  input: CaptureLeadInput
): Promise<{ result: string; jobId: string | null }> {
  if (!currentJobId) {
    const hasTradeAnswers = input.trade_answers && Object.keys(input.trade_answers).length > 0;
    const normalizedAnswers = hasTradeAnswers ? await normalizeTradeAnswers(supabase, businessId, input.trade_answers!) : {};

    // §CRM completeness — same rule as lib/phone-ai.ts's handleUpdateJobDraft:
    // a widget lead's info previously only ever lived on the job row itself,
    // never a real clients record, so they could never be recognized on a
    // future visit/call and never showed up on the Clients page. Only
    // trust a phone match once the visitor's own stated name backs it up
    // (namesLikelyMatch); otherwise create a fresh client once a name is
    // actually known.
    const name = input.name?.trim();
    const phone = input.phone?.trim() || null;
    let clientId: string | null = null;
    if (phone) {
      const matched = await findMatchingClient(supabase, businessId, phone);
      if (matched && name && namesLikelyMatch(name, matched.name)) clientId = matched.id;
    }
    if (!clientId && name) {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({ business_id: businessId, name, phone })
        .select("id")
        .single();
      clientId = newClient?.id ?? null;
    }

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        client_id: clientId,
        source: "widget",
        customer_name: input.name?.trim() || "Website visitor",
        customer_phone: input.phone?.trim() || null,
        job_label: input.job_description?.trim() || null,
        trade_answers: normalizedAnswers,
        confidence: "Low",
      })
      .select("id")
      .single();

    if (error || !job) {
      console.error("[widget-ai] capture_lead insert failed:", JSON.stringify(error));
      return { result: JSON.stringify({ ok: false }), jobId: null };
    }

    await supabase.from("widget_chat_captures").update({ job_id: job.id }).eq("session_id", sessionId);
    return { result: JSON.stringify({ ok: true }), jobId: job.id };
  }

  const patch: Record<string, unknown> = {};
  if (input.name?.trim()) patch.customer_name = input.name.trim();
  if (input.phone?.trim()) patch.customer_phone = input.phone.trim();
  if (input.job_description?.trim()) patch.job_label = input.job_description.trim();

  // Merge, never clobber — a later call with fewer known fields shouldn't
  // erase what an earlier call already captured.
  if (input.trade_answers && Object.keys(input.trade_answers).length > 0) {
    const [{ data: existing }, normalizedAnswers] = await Promise.all([
      supabase.from("jobs").select("trade_answers").eq("id", currentJobId).maybeSingle(),
      normalizeTradeAnswers(supabase, businessId, input.trade_answers),
    ]);
    patch.trade_answers = { ...(existing?.trade_answers ?? {}), ...normalizedAnswers };
  }

  // §CRM completeness — same deferred-creation case as lib/phone-ai.ts:
  // the name wasn't known when the job was first created (e.g. the job
  // description came before the visitor gave their name).
  if (patch.customer_name) {
    const { data: existingJob } = await supabase
      .from("jobs")
      .select("client_id, customer_phone")
      .eq("id", currentJobId)
      .maybeSingle();

    if (existingJob && !existingJob.client_id) {
      const phone = (patch.customer_phone as string | undefined) || existingJob.customer_phone || null;
      let clientId: string | null = null;
      if (phone) {
        const matched = await findMatchingClient(supabase, businessId, phone);
        if (matched && namesLikelyMatch(patch.customer_name as string, matched.name)) clientId = matched.id;
      }
      if (!clientId) {
        const { data: newClient } = await supabase
          .from("clients")
          .insert({ business_id: businessId, name: patch.customer_name as string, phone })
          .select("id")
          .single();
        clientId = newClient?.id ?? null;
      }
      if (clientId) patch.client_id = clientId;
    }
  }

  if (Object.keys(patch).length > 0) {
    await supabase.from("jobs").update(patch).eq("id", currentJobId);
  }
  return { result: JSON.stringify({ ok: true }), jobId: currentJobId };
}

// A visitor worth flagging is worth a record, even if the AI hasn't
// learned their name yet — same fallback lib/phone-ai.ts's
// handleFlagForAttention uses.
async function handleFlagForAttention(
  supabase: SupabaseClient,
  businessId: string,
  sessionId: string,
  currentJobId: string | null,
  appOrigin: string,
  input: { priority?: "low" | "medium" | "high"; reason?: string }
): Promise<{ result: string; jobId: string | null }> {
  const priority = input.priority ?? "low";

  let jobId = currentJobId;
  if (!jobId) {
    const { data: newJob, error } = await supabase
      .from("jobs")
      .insert({ business_id: businessId, source: "widget", customer_name: "Website visitor", confidence: "Low" })
      .select("id")
      .single();
    if (error || !newJob) {
      console.error("[widget-ai] flag_for_attention job insert failed:", JSON.stringify(error));
      return { result: JSON.stringify({ ok: false }), jobId: null };
    }
    jobId = newJob.id as string;
    await supabase.from("widget_chat_captures").update({ job_id: jobId }).eq("session_id", sessionId);
  }

  const { data: job } = await supabase.from("jobs").select("customer_name").eq("id", jobId).maybeSingle();

  await supabase.from("jobs").update({ attention_priority: priority }).eq("id", jobId);

  // Reuses the exact Needs Attention inbox Messenger/phone AI already
  // built — a "messages" row is what makes this job show up there.
  await supabase.from("messages").insert({
    job_id: jobId,
    business_id: businessId,
    sender: "ai",
    body: `Website chat needs your attention${input.reason ? ` — ${input.reason}` : "."} See the conversation transcript on this job for full context.`,
    visible_to_customer: false,
  });

  if (priority === "high") {
    await notifyOwnerHighPriority(supabase, businessId, job?.customer_name ?? "A website visitor", jobId, appOrigin);

    const { data: profile } = await supabase
      .from("business_profiles")
      .select("phone")
      .eq("user_id", businessId)
      .maybeSingle();
    if (profile?.phone) {
      await sendSms(profile.phone, `WorkRoute: ${job?.customer_name ?? "A website visitor"} needs you urgently — check ${appOrigin}/app/jobs/${jobId}`);
    }
  }

  return { result: JSON.stringify({ ok: true }), jobId };
}

type AvailabilityInput = { date?: string; time?: string; block?: "Morning" | "Afternoon" | "Evening" };

async function handleCheckAvailability(
  supabase: SupabaseClient,
  businessId: string,
  jobId: string | null,
  input: AvailabilityInput
): Promise<string> {
  if (!jobId || !input.date) {
    return JSON.stringify({ available: false, error: "No date given, or no lead captured yet." });
  }

  const result = await checkAvailability(supabase, businessId, jobId, {
    date: input.date,
    time: input.time ?? null,
    block: input.block ?? null,
  });
  return JSON.stringify(result);
}

// Mirrors lib/phone-ai.ts's handleBookAppointment almost exactly — same
// quote-visit-vs-job decision (via recalculateEstimate, imported from
// there rather than duplicated), same reuse of
// checkAvailability/rescheduleJob (lib/messenger-scheduling.ts), same
// booking-confirmed SMS every other first-time scheduling path sends. The
// one real difference: a website visitor has no caller-ID phone fallback
// like a phone call does, so the SMS only fires if capture_lead actually
// got a phone number from them.
async function handleBookAppointment(
  supabase: SupabaseClient,
  business: WidgetBusinessContext,
  jobId: string | null,
  appOrigin: string,
  input: AvailabilityInput
): Promise<string> {
  if (!jobId || !input.date) {
    return JSON.stringify({ ok: false, error: "No date given, or no lead captured yet — call capture_lead first." });
  }

  await recalculateEstimate(supabase, business.businessId, jobId);

  const { data: job } = await supabase
    .from("jobs")
    .select("quote_required, customer_name, customer_phone, customer_access_token")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return JSON.stringify({ ok: false, error: "Job not found." });

  await rescheduleJob(supabase, jobId, business.businessId, {
    date: input.date,
    time: input.time ?? null,
    block: input.block ?? null,
  });
  await supabase.from("jobs").update({ status: "Scheduled" }).eq("id", jobId);

  if (job.customer_phone) {
    const messengerLink = `${appOrigin}/m/${job.customer_access_token}`;
    const message = messageFor("booking_confirmed", job.customer_name, business.firstName, business.businessName, messengerLink);
    await sendSms(job.customer_phone, message);
  }

  return JSON.stringify({ ok: true, quoteRequired: job.quote_required });
}

// supabase must be the service-role client — tool calls write directly to
// jobs/widget_chat_captures, same trust model as Messenger/phone AI.
// businessId/sessionId always come from the caller's already-resolved
// context (route.ts resolves business from widget_key before this is ever
// called), never from the model's tool input.
export async function generateWidgetReply(
  supabase: SupabaseClient,
  business: WidgetBusinessContext,
  sessionId: string,
  initialJobId: string | null,
  history: WidgetHistoryItem[],
  appOrigin: string
): Promise<WidgetAiResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = history.slice(-20).map((m) => ({
    role: m.sender === "visitor" ? "user" : "assistant",
    content: m.body,
  }));

  let priority: "low" | "medium" | "high" | null = null;
  let jobId = initialJobId;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(business),
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((block) => block.type === "text");
        const reply = textBlock?.type === "text" ? textBlock.text : "";
        if (!reply) {
          // Kept as a defensive retry even though the actual root cause here
          // turned out to be model-specific, not random: claude-haiku
          // deterministically returned empty content (stop_reason "end_turn",
          // zero content blocks) on the round immediately after any
          // tool_use/tool_result exchange — 100% reproducible in isolated
          // testing, which is what led to switching MODEL to claude-sonnet-5
          // above. This branch stays anyway as cheap insurance against a
          // genuine rare upstream hiccup on any model — retrying costs
          // little and a real empty-response fluke shouldn't fail a
          // visitor's message outright.
          console.error(
            `[widget-ai] session ${sessionId}: empty response on round ${round} (stop_reason=${response.stop_reason}), retrying`
          );
          continue;
        }
        return { ok: true, reply, priority, jobId };
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        if (block.name === "capture_lead") {
          const { result, jobId: newJobId } = await handleCaptureLead(
            supabase,
            business.businessId,
            sessionId,
            jobId,
            block.input as CaptureLeadInput
          );
          jobId = newJobId;
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } else if (block.name === "flag_for_attention") {
          const { result, jobId: newJobId } = await handleFlagForAttention(
            supabase,
            business.businessId,
            sessionId,
            jobId,
            appOrigin,
            block.input as { priority?: "low" | "medium" | "high"; reason?: string }
          );
          jobId = newJobId;
          priority = (block.input as { priority?: "low" | "medium" | "high" }).priority ?? "low";
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } else if (block.name === "check_availability") {
          const result = await handleCheckAvailability(supabase, business.businessId, jobId, block.input as AvailabilityInput);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } else if (block.name === "book_appointment") {
          const result = await handleBookAppointment(supabase, business, jobId, appOrigin, block.input as AvailabilityInput);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    console.error(`[widget-ai] session ${sessionId}: exhausted ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply`);
    return { ok: false };
  } catch (error) {
    console.error(`[widget-ai] session ${sessionId}: threw —`, error);
    return { ok: false };
  }
}
