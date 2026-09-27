import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyAdminOfSalesLead } from "./push-notifications";
import { sendSalesLeadEmail, sendTrialLinkEmail } from "./resend";
import type { WidgetHistoryItem } from "./widget-ai";

// §WorkRoute sales chat — the website chat widget on WorkRoute's OWN
// marketing site (workroute.com.au), as opposed to lib/widget-ai.ts, which
// is Sarah working for a tradie on the tradie's site. Here Sarah sells
// WorkRoute itself: answers questions about the product and captures
// interested tradies for the owner to follow up. It's reached through one
// reserved widget key (WORKROUTE_SALES_WIDGET_KEY) that isn't tied to any
// tradie's business, so nothing here ever creates jobs or clients.

// The key pasted into workroute.com.au's widget snippet. Checked before any
// business_profiles lookup in the widget route and frame.
export const WORKROUTE_SALES_WIDGET_KEY = "894dd6b7-a590-4643-9c48-c1c4b4715ab5";

export const WORKROUTE_SALES_DISPLAY_NAME = "WorkRoute";

// Same model/budget reasoning as lib/widget-ai.ts.
const MODEL = "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 4;
const MAX_TOKENS = 1024;

const SIGNUP_URL = "https://app.workroute.com.au/signup";

// Facts mirror the live marketing page — keep in sync if pricing, the trial
// or the feature list changes there.
function systemPrompt(): string {
  return `You are Sarah, WorkRoute's AI Office Manager, chatting with a visitor on WorkRoute's own website (workroute.com.au). WorkRoute is an Australian app for lawn-mowing businesses, and you are the same AI that answers calls and chats for WorkRoute customers — so this chat is also a live demo of you. If asked whether you're an AI, say yes happily.

Reply naturally and briefly, like a text message — a sentence or two, not a paragraph. Australian, friendly, no hard sell.

What you know about WorkRoute (only state facts from this list — if asked something not covered, say you're not sure and offer to have Steve, the founder, get back to them):
- Built for independent lawn-mowing businesses. Other trades aren't the focus right now; if a visitor is in another trade, say so honestly and offer to pass their details to Steve.
- Price: $199/month, everything included, one simple monthly subscription, paid by card. No separate feature subscriptions.
- Free trial: 14 days or 150 calls, whichever comes first. They can start it at ${SIGNUP_URL} (don't say anything about whether a card is needed, contracts or cancelling — offer to have Steve answer that).
- Sarah answers the business's phone calls, website chat and SMS 24/7 with an Australian voice, and can give the caller a real price guide on the call using the tradie's own pricing (always explained as an estimate that may change once the job is seen).
- Recognises returning callers and their usual service and price; checks real availability and books into the diary.
- Smart Route plans the day's run using real driving time. "On My Way" texts the customer a calculated ETA; "Delay" sends a quick held-up message.
- Recurring visits booked ahead, customer records and history, before/after job photos.
- Voice job notes: the tradie talks through the job and WorkRoute writes the job record and a numbered invoice, sent by email or Messenger. Cash or bank transfer supported. Unpaid-invoice chasing.
- Google review requests after jobs, win-back calling of past customers, VIP caller alerts.
- A 3pm daily brief of tomorrow's jobs, route and weather.
- Kilometre records between jobs (supporting records only, not a formal ATO logbook).
- Xero, MYOB, QuickBooks and Zapier integrations. Installs on the phone like an app with push notifications.
- Setup is a simple form: services, pricing, working hours, service area. No technical skills needed.
- No lock-in: they can download their full customer list any time.

Your goals, in order:
1. Answer their questions honestly and simply.
2. If they sound interested in the free trial, offer to email them the sign-up link. Ask for their first name and email address (one at a time), then call send_trial_link. Tell them it's on its way and to check their spam folder if it doesn't show up. Also include the link ${SIGNUP_URL} in that reply so they can start straight away. If they don't want to give an email, just give them the link.
3. If they'd rather talk to a person, have questions you can't answer, or want help getting set up, offer to have Steve call or email them. Get their name, their business name, and a phone number or email — one question at a time. Call save_prospect as soon as you have their name plus a phone number or email, and again if they add something new. Then tell them Steve will be in touch.

Never make up features, prices, discounts, dates or promises. Never discuss other WorkRoute customers. Never use the word "escrow".`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "save_prospect",
    description:
      "Save an interested visitor's details so Steve (WorkRoute's founder) can follow up. Call once you have their name plus a phone number or email, and again whenever they give you something new.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The visitor's name" },
        phone: { type: "string", description: "Phone number, if given" },
        email: { type: "string", description: "Email address, if given" },
        business: { type: "string", description: "Their business name and/or trade and area, if given" },
        notes: { type: "string", description: "One short sentence on what they want or asked about" },
      },
      required: ["name"],
    },
  },
  {
    name: "send_trial_link",
    description:
      "Email the visitor the free-trial sign-up link, and let Steve know so he can follow up on how they're going. Call once you have their first name and email address.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The visitor's name" },
        email: { type: "string", description: "The visitor's email address" },
        phone: { type: "string", description: "Phone number, if given" },
        business: { type: "string", description: "Their business name and/or trade and area, if given" },
      },
      required: ["name", "email"],
    },
  },
];

export type SalesProspect = { name?: string; phone?: string; email?: string; business?: string; notes?: string };

async function handleSaveProspect(
  supabase: SupabaseClient,
  sessionId: string,
  transcript: WidgetHistoryItem[],
  appOrigin: string,
  input: SalesProspect
): Promise<string> {
  if (!input.phone?.trim() && !input.email?.trim()) {
    return JSON.stringify({ ok: false, error: "Need a phone number or email before saving." });
  }

  await supabase.from("widget_chat_captures").update({ status: "captured" }).eq("session_id", sessionId);

  // Notification failures shouldn't break the visitor's chat — the
  // transcript is already saved on the capture row either way.
  const [, email] = await Promise.allSettled([
    notifyAdminOfSalesLead(supabase, input.name ?? "A website visitor", appOrigin),
    sendSalesLeadEmail(input, transcript),
  ]);
  if (email.status === "rejected" || !email.value.ok) {
    console.error(`[workroute-sales-ai] session ${sessionId}: lead email failed —`, email.status === "fulfilled" ? email.value.error : email.reason);
  }
  return JSON.stringify({ ok: true });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleSendTrialLink(
  supabase: SupabaseClient,
  sessionId: string,
  transcript: WidgetHistoryItem[],
  appOrigin: string,
  input: SalesProspect
): Promise<string> {
  const email = input.email?.trim() ?? "";
  if (!EMAIL_RE.test(email)) {
    return JSON.stringify({ ok: false, error: "That doesn't look like a valid email — ask them to check it." });
  }

  const sent = await sendTrialLinkEmail(email, input.name?.trim() || null, SIGNUP_URL);
  if (!sent.ok) {
    console.error(`[workroute-sales-ai] session ${sessionId}: trial link email failed —`, sent.error);
    return JSON.stringify({ ok: false, error: "The email didn't send — give them the link in the chat instead." });
  }

  // Steve gets the same lead email/push as a follow-up request, so he can
  // check in on how their trial is going.
  await handleSaveProspect(supabase, sessionId, transcript, appOrigin, {
    ...input,
    notes: "Emailed the free trial sign-up link — follow up to see if they signed up and how they're going.",
  });
  return JSON.stringify({ ok: true });
}

export async function generateSalesReply(
  supabase: SupabaseClient,
  sessionId: string,
  history: WidgetHistoryItem[],
  appOrigin: string
): Promise<{ ok: true; reply: string; captured: boolean } | { ok: false }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = history.slice(-20).map((m) => ({
    role: m.sender === "visitor" ? "user" : "assistant",
    content: m.body,
  }));

  let captured = false;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(),
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((block) => block.type === "text");
        const reply = textBlock?.type === "text" ? textBlock.text : "";
        // Same defensive empty-response retry as lib/widget-ai.ts.
        if (!reply) continue;
        return { ok: true, reply, captured };
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        if (block.name === "save_prospect") {
          const result = await handleSaveProspect(supabase, sessionId, history, appOrigin, block.input as SalesProspect);
          if (JSON.parse(result).ok) captured = true;
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } else if (block.name === "send_trial_link") {
          const result = await handleSendTrialLink(supabase, sessionId, history, appOrigin, block.input as SalesProspect);
          if (JSON.parse(result).ok) captured = true;
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    console.error(`[workroute-sales-ai] session ${sessionId}: exhausted ${MAX_TOOL_ROUNDS} tool-call rounds without a final reply`);
    return { ok: false };
  } catch (error) {
    console.error(`[workroute-sales-ai] session ${sessionId}: threw —`, error);
    return { ok: false };
  }
}
