import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  generateMessengerReply,
  insertAiMessage,
  applyAttentionPriority,
  type MessengerJobContext,
  type MessengerHistoryItem,
} from "@/lib/messenger-ai";
import { notifyCustomerNewMessage } from "@/lib/push-notifications";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THROTTLE_WINDOW_MS = 5 * 60 * 1000;
const THROTTLE_MAX_MESSAGES = 10;

type ThreadRow = {
  job_id: string;
  business_id: string;
  ai_paused: boolean;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_block: "Morning" | "Afternoon" | "Evening" | null;
  customer_name: string;
  business_name: string;
  first_name: string | null;
  recurring_renewal_prompted_at: string | null;
  recurring_renewal_declined_at: string | null;
  messages: { id: string; sender: "customer" | "ai" | "tradie"; body: string; created_at: string }[];
};

// §Messenger — the only write path a customer can reach. Public (no auth —
// there's no such thing as a signed-in customer), gated entirely by
// knowing the token. Inserts the customer's message via the token-validated
// RPC, then generates and stores the AI's reply from this trusted server
// context — the model itself never gets a credential that could insert a
// message directly.
export async function POST(request: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ ok: false, error: "Invalid link." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const messageBody = typeof body?.message === "string" ? body.message.trim() : "";
  if (!messageBody || messageBody.length > 2000) {
    return NextResponse.json({ ok: false, error: "Message is empty or too long." }, { status: 400 });
  }

  const supabase = createClient();

  const { data: threadData } = await supabase.rpc("messenger_get_thread", { p_token: token });
  const thread = threadData as ThreadRow | null;
  if (!thread) {
    return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 404 });
  }

  const recentCustomerMessages = thread.messages.filter(
    (m) => m.sender === "customer" && Date.now() - new Date(m.created_at).getTime() < THROTTLE_WINDOW_MS
  );
  if (recentCustomerMessages.length >= THROTTLE_MAX_MESSAGES) {
    return NextResponse.json({ ok: false, error: "Too many messages — try again shortly." }, { status: 429 });
  }

  const { error: sendError } = await supabase.rpc("messenger_send_customer_message", {
    p_token: token,
    p_body: messageBody,
  });
  if (sendError) {
    return NextResponse.json({ ok: false, error: "Couldn't send your message." }, { status: 500 });
  }

  // The AI never replies to a paused thread — a tradie has already taken
  // over this conversation. The customer's message is still stored above.
  if (thread.ai_paused) {
    return NextResponse.json({ ok: true, aiReplied: false });
  }

  const jobContext: MessengerJobContext = {
    id: thread.job_id,
    businessId: thread.business_id,
    customerName: thread.customer_name,
    status: thread.status,
    scheduledDate: thread.scheduled_date,
    scheduledTime: thread.scheduled_time,
    scheduledBlock: thread.scheduled_block,
    businessName: thread.business_name,
    firstName: thread.first_name,
    pendingRenewal: Boolean(thread.recurring_renewal_prompted_at) && !thread.recurring_renewal_declined_at,
  };

  const history: MessengerHistoryItem[] = [
    ...thread.messages.map((m) => ({ sender: m.sender, body: m.body })),
    { sender: "customer" as const, body: messageBody },
  ];

  const serviceRole = createServiceRoleClient();
  const appOrigin = new URL(request.url).origin;
  const result = await generateMessengerReply(serviceRole, jobContext, history);

  if (!result.ok) {
    // Fail toward visibility, not silence — no fake "ai" message is
    // inserted, so nothing appears falsely AI-authored.
    await applyAttentionPriority(serviceRole, jobContext, "high", appOrigin);
    return NextResponse.json({ ok: true, aiReplied: false });
  }

  await insertAiMessage(serviceRole, jobContext.id, jobContext.businessId, result.reply);
  await notifyCustomerNewMessage(serviceRole, jobContext.id, jobContext.businessName, appOrigin);
  if (result.priority) {
    await applyAttentionPriority(serviceRole, jobContext, result.priority, appOrigin);
  }

  return NextResponse.json({ ok: true, aiReplied: true });
}
