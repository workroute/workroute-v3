import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "./mobile-message";
import { checkAvailability, rescheduleJob } from "./messenger-scheduling";
import { getRecentKnowledge, type KnowledgeEntry } from "./ai-knowledge";
import { notifyOwnerHighPriority } from "./push-notifications";
import { renewSeriesFromLastJob, markRenewalDeclined } from "./recurring-jobs";

// §Messenger — the AI agent that replies in WorkRoute Messenger. Server-only:
// reads ANTHROPIC_API_KEY from process.env directly, so this must never be
// imported from a "use client" component.

export type MessengerJobContext = {
  id: string;
  businessId: string;
  customerName: string;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduledBlock: "Morning" | "Afternoon" | "Evening" | null;
  businessName: string;
  firstName: string | null;
  // True only while this job's own recurring-renewal reminder is open (sent,
  // not yet answered) — see app/api/cron/recurring-renewals and
  // lib/recurring-jobs.ts. Gates both the extra prompt section and the
  // confirm_recurring_renewal tool below, so the AI can't offer/act on a
  // renewal on any other conversation.
  pendingRenewal: boolean;
};

export type MessengerHistoryItem = { sender: "customer" | "ai" | "tradie"; body: string };

export type MessengerAiResult =
  | { ok: true; reply: string; priority: "low" | "medium" | "high" | null }
  | { ok: false };

const MODEL = "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 4;
// This model returns an extended-thinking block alongside its actual reply
// when tools are in play, and thinking tokens count against max_tokens —
// too tight a budget here means the model can burn it all on thinking and
// never get to write the customer-facing text at all.
const MAX_TOKENS = 1024;

// §23: reinforced here, not just assumed — the AI is explicitly told never
// to reveal WorkRoute or that it's an AI at all; it's simply how the
// business itself replies.
// AI Knowledge — owner-approved examples of how this specific business has
// actually resolved similar situations before (see lib/ai-knowledge.ts).
// Described in prose here rather than fed in as real conversation turns:
// mixing synthetic example turns into the same message array as the real
// thread risks confusing Anthropic's tool-use structure, and prose framing
// lets us be explicit that these are style/judgement calibration, not
// literal facts to repeat regardless of whether they still apply.
function knowledgeSection(examples: KnowledgeEntry[]): string {
  if (examples.length === 0) return "";
  const lines = examples
    .map((e) => `- Customer asked: "${e.customer_message}" → We said: "${e.resolution}"`)
    .join("\n");
  return `\n\nHere's how this business has actually handled similar situations recently — use these to calibrate your tone and judgement, not as literal facts to repeat if the current situation is different (a specific time or price from an old example may no longer apply):\n${lines}`;
}

// Without this, the model has no way to know the real current date and
// resolves a relative/partial reschedule date ("next Tuesday," "the 10th")
// against whatever year it associates with "now" from training — the same
// bug confirmed on a real booking in the website widget that landed a year
// in the past, fixed there and mirrored here since this has the identical
// check_availability/reschedule_this_job tools. No per-business timezone
// field exists yet — Australia/Brisbane (no daylight saving) is the same
// single-region default used elsewhere (lib/phone-ai.ts).
function todayForPrompt(): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Australia/Brisbane",
  }).format(new Date());
}

function systemPrompt(job: MessengerJobContext, knowledge: KnowledgeEntry[]): string {
  const tradieName = job.firstName ?? "the tradie";
  const when = job.scheduledDate
    ? ` for ${job.scheduledDate}${
        job.scheduledTime
          ? ` at ${job.scheduledTime.slice(0, 5)}`
          : job.scheduledBlock
            ? ` (${job.scheduledBlock})`
            : ""
      }`
    : "";

  return `You are how ${job.businessName} handles customer messages — never say you are an AI, a bot, or mention "WorkRoute" in any form. You are simply ${job.businessName} replying.

Reply naturally and briefly, like a text message — a sentence or two, not a paragraph. Never invent a scheduling commitment you haven't confirmed with a tool.

Today is ${todayForPrompt()}. Use this as the real current date when the customer gives a relative or partial date ("next Tuesday," "the 10th") — resolve it to the correct upcoming date yourself before calling check_availability/reschedule_this_job, never guess a year from anything else.

This conversation is about one specific job for ${job.customerName}, currently ${job.status}${when}.

If the customer asks to change the date/time of THIS appointment to a specific date/time: call check_availability first. If it's free, call reschedule_this_job immediately after, then tell the customer directly that it's confirmed — do not involve ${tradieName}. If it conflicts, do not guess or promise anything — call flag_for_attention with priority "medium" (a real, specific, blocked scheduling request always warrants at least medium, whether or not the job is today), and explicitly tell the customer something like "I'll check with ${tradieName} and get back to you shortly" so they're never left wondering. If they've given a date but only a loose block (morning/afternoon/evening) rather than an exact time, call check_availability with that block anyway — it comes back with suggestedTimes, real options already confirmed free, to offer the customer directly ("I could do 1, 3, or 4:30 — which suits?") instead of asking them to guess an exact time themselves. Once they pick one, call reschedule_this_job directly with that exact time — no need to check again. Only ask a clarifying question if they haven't given any date at all yet.

For anything else you can't fully and concretely resolve yourself — a genuine question or request you don't have a specific answer to, even a low-stakes one like general availability, preferences, or something for later — call flag_for_attention with priority "low" so it's logged for ${tradieName} to see when they get a chance, in addition to giving the customer an honest, brief reply. The only messages that need no flag at all are ones with nothing actually being asked or requested — a simple thank-you or compliment just gets a warm reply.

Call flag_for_attention with priority "high" only when waiting would cause real harm: an emergency, the customer on-site and unable to get in, a cancellation affecting ${tradieName}'s very next job, ${tradieName} about to miss this appointment, an explicit request to speak to ${tradieName} urgently, a safety issue, or anything blocking that needs a decision before work can proceed. Still give the customer a brief, reassuring reply either way.

Only escalate to ${tradieName} when human judgement is genuinely required — try to resolve things yourself first using the conversation and the tools available. Call flag_for_attention at most once per reply, before your final text response.${knowledgeSection(knowledge)}${
    job.pendingRenewal
      ? `\n\nThis customer was just sent a message asking whether they want their next 5 regular visits booked in, since their current series is running out. If they say yes/agree/sounds good, call confirm_recurring_renewal with accepted true and let them know it's booked. If they say no/not right now/stop, call confirm_recurring_renewal with accepted false and reply warmly without pressuring them. If their reply doesn't actually answer that question, just respond naturally and don't call the tool yet.`
      : ""
  }`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description:
      "Check whether a specific date and time (or time-of-day block) is free on the business's schedule, before offering to move this appointment. For a block only (no specific time), the result comes back with suggestedTimes — real, already-confirmed-free times within that block to offer the customer directly.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM in 24-hour time, if the customer asked for a specific time" },
        block: {
          type: "string",
          enum: ["Morning", "Afternoon", "Evening"],
          description: "If the customer asked for a time-of-day block instead of a specific time",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "reschedule_this_job",
    description: "Move this appointment to a new date/time. Only call this immediately after check_availability confirms the slot is free.",
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
  {
    name: "flag_for_attention",
    description: "Flag this conversation for the tradie's attention because you can't confidently resolve it yourself.",
    input_schema: {
      type: "object",
      properties: {
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["priority"],
    },
  },
];

const CONFIRM_RENEWAL_TOOL: Anthropic.Tool = {
  name: "confirm_recurring_renewal",
  description:
    "Call this once the customer has answered the recurring-service renewal reminder, to record whether they want their next 5 visits booked in.",
  input_schema: {
    type: "object",
    properties: {
      accepted: {
        type: "boolean",
        description: "true if the customer wants the next 5 visits booked, false if they don't want to renew right now",
      },
    },
    required: ["accepted"],
  },
};

type ScheduleToolInput = { date: string; time?: string; block?: "Morning" | "Afternoon" | "Evening" };

// supabase must be the service-role client — the tool calls write directly
// to jobs (reschedule) and need to bypass RLS the same way AI-message
// insertion does. job_id/business_id always come from the already-resolved
// job context below, never from the model's tool input.
export async function generateMessengerReply(
  supabase: SupabaseClient,
  job: MessengerJobContext,
  history: MessengerHistoryItem[]
): Promise<MessengerAiResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const knowledge = await getRecentKnowledge(supabase, job.businessId);

  const messages: Anthropic.MessageParam[] = history.slice(-20).map((m) => ({
    role: m.sender === "customer" ? "user" : "assistant",
    content: m.body,
  }));

  let priority: "low" | "medium" | "high" | null = null;
  const tools = job.pendingRenewal ? [...TOOLS, CONFIRM_RENEWAL_TOOL] : TOOLS;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(job, knowledge),
        tools,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((block) => block.type === "text");
        const reply = textBlock?.type === "text" ? textBlock.text : "";
        if (!reply) {
          console.error(
            `[messenger-ai] job ${job.id}: no text in response (stop_reason=${response.stop_reason}, content types=${response.content.map((b) => b.type).join(",")})`
          );
          return { ok: false };
        }
        return { ok: true, reply, priority };
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        if (block.name === "check_availability") {
          const input = block.input as ScheduleToolInput;
          const result = await checkAvailability(supabase, job.businessId, job.id, {
            date: input.date,
            time: input.time ?? null,
            block: input.block ?? null,
          });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        } else if (block.name === "reschedule_this_job") {
          const input = block.input as ScheduleToolInput;
          await rescheduleJob(supabase, job.id, job.businessId, {
            date: input.date,
            time: input.time ?? null,
            block: input.block ?? null,
          });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Rescheduled." });
        } else if (block.name === "flag_for_attention") {
          const input = block.input as { priority: "low" | "medium" | "high" };
          priority = input.priority;
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Flagged." });
        } else if (block.name === "confirm_recurring_renewal") {
          const input = block.input as { accepted: boolean };
          if (input.accepted) {
            const series = await renewSeriesFromLastJob(supabase, job.businessId, job.id);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: series ? `Renewed — ${series.createdDates.length} more visits booked.` : "Couldn't renew — no recurring frequency on this job.",
            });
          } else {
            await markRenewalDeclined(supabase, job.id);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Noted — no renewal." });
          }
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    console.error(`[messenger-ai] job ${job.id}: exhausted ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply`);
    return { ok: false };
  } catch (error) {
    console.error(`[messenger-ai] job ${job.id}: threw —`, error);
    return { ok: false };
  }
}

// supabase must be the service-role client — this is the one place an
// "ai"-sender row should ever be created, and it's never reachable from any
// client-callable surface (no RPC, no browser call).
export async function insertAiMessage(
  supabase: SupabaseClient,
  jobId: string,
  businessId: string,
  body: string
): Promise<void> {
  await supabase.from("messages").insert({ job_id: jobId, business_id: businessId, sender: "ai", body });
}

// Stores the priority, and for "high" also pushes + texts the tradie
// immediately — push via owner_push_subscriptions (lib/push-notifications.ts),
// SMS as the reliable fallback via the existing sendSms()/Mobile Message
// path. Both fire independently; push doesn't require a phone on file.
export async function applyAttentionPriority(
  supabase: SupabaseClient,
  job: MessengerJobContext,
  priority: "low" | "medium" | "high",
  appOrigin: string
): Promise<void> {
  await supabase.from("jobs").update({ attention_priority: priority }).eq("id", job.id);

  if (priority !== "high") return;

  await notifyOwnerHighPriority(supabase, job.businessId, job.customerName, job.id, appOrigin);

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("phone")
    .eq("user_id", job.businessId)
    .maybeSingle();

  if (!profile?.phone) return;

  await sendSms(
    profile.phone,
    `WorkRoute: ${job.customerName} needs you urgently. Check ${appOrigin}/app/jobs/${job.id}`
  );
}
