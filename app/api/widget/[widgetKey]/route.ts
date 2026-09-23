import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateWidgetReply, type WidgetHistoryItem } from "@/lib/widget-ai";

// §Website Widget — the public endpoint an embedded chat widget on an
// arbitrary third-party website calls. No auth possible here by design —
// widget_key is meant to be public (visible in the tradie's page source,
// like a Stripe/Intercom publishable key), unlike Messenger's per-job token
// (shared with exactly one customer via SMS) or the phone number (costs an
// attacker real calling effort). That's why this is the one WorkRoute
// surface with real DB-backed rate limiting rather than just an inline
// per-conversation counter — see checkRateLimit below.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Wildcard origin is correct and safe here specifically because nothing
// credentialed (cookies) is involved — sessionId travels in the request
// body, not a cookie — and the widget must work on literally any domain a
// tradie pastes it into, with no domain registry to allowlist against.
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const PER_SESSION_WINDOW_MS = 30 * 60 * 1000;
const PER_SESSION_MAX = 20;
const PER_BUSINESS_WINDOW_MS = 60 * 60 * 1000;
const PER_BUSINESS_MAX = 150;

async function isRateLimited(
  supabase: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  sessionId: string
): Promise<boolean> {
  const now = Date.now();

  const { count: sessionCount } = await supabase
    .from("widget_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .gte("created_at", new Date(now - PER_SESSION_WINDOW_MS).toISOString());
  if ((sessionCount ?? 0) >= PER_SESSION_MAX) return true;

  const { count: businessCount } = await supabase
    .from("widget_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", new Date(now - PER_BUSINESS_WINDOW_MS).toISOString());
  if ((businessCount ?? 0) >= PER_BUSINESS_MAX) return true;

  return false;
}

export async function POST(request: Request, { params }: { params: { widgetKey: string } }) {
  if (!UUID_RE.test(params.widgetKey)) {
    return json({ ok: false, error: "Invalid widget key." }, 400);
  }

  const body = await request.json().catch(() => null);
  const sessionId: string | undefined = body?.sessionId;
  const message: string | undefined = body?.message;

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return json({ ok: false, error: "Missing or invalid sessionId." }, 400);
  }
  const trimmed = message?.trim();
  if (!trimmed || trimmed.length > 2000) {
    return json({ ok: false, error: "Message must be 1-2000 characters." }, 400);
  }

  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("user_id, business_name, first_name, trade")
    .eq("widget_key", params.widgetKey)
    .maybeSingle();

  if (!profile) {
    return json({ ok: false, error: "This widget isn't connected to a WorkRoute business." }, 404);
  }

  if (await isRateLimited(supabase, profile.user_id, sessionId)) {
    return json({ ok: false, error: "Too many messages — please try again shortly." }, 429);
  }

  // One row per session_id — the visitor's first message creates it, every
  // later message in the same conversation (same session_id, persisted in
  // the widget's own localStorage) reuses it rather than starting a new
  // capture. Mirrors phone_call_captures's upsert-on-first-touch pattern.
  const { data: existingCapture } = await supabase
    .from("widget_chat_captures")
    .select("job_id, transcript_messages")
    .eq("session_id", sessionId)
    .maybeSingle();

  const transcript: WidgetHistoryItem[] = (existingCapture?.transcript_messages as WidgetHistoryItem[] | null) ?? [];
  transcript.push({ sender: "visitor", body: trimmed });

  if (!existingCapture) {
    await supabase.from("widget_chat_captures").insert({
      business_id: profile.user_id,
      session_id: sessionId,
      transcript_messages: transcript,
    });
  }

  // Logged before calling Claude — a burst that gets rejected above
  // shouldn't also count twice against the window once it's finally let
  // through.
  await supabase.from("widget_rate_limit_events").insert({ business_id: profile.user_id, session_id: sessionId });

  const appOrigin = new URL(request.url).origin;
  const result = await generateWidgetReply(
    supabase,
    { businessId: profile.user_id, businessName: profile.business_name, firstName: profile.first_name, trade: profile.trade },
    sessionId,
    existingCapture?.job_id ?? null,
    transcript,
    appOrigin
  );

  if (!result.ok) {
    await supabase
      .from("widget_chat_captures")
      .update({ transcript_messages: transcript, last_message_at: new Date().toISOString() })
      .eq("session_id", sessionId);
    return json({ ok: false, error: "Something went wrong — please try again in a moment." }, 502);
  }

  transcript.push({ sender: "ai", body: result.reply });
  await supabase
    .from("widget_chat_captures")
    .update({
      transcript_messages: transcript,
      last_message_at: new Date().toISOString(),
      // "captured" once capture_lead has actually created a job — not
      // related to attention priority, which is a separate concern (a
      // flagged conversation can still be mid-capture, or already captured).
      status: result.jobId ? "captured" : "in_progress",
    })
    .eq("session_id", sessionId);

  return json({ ok: true, reply: result.reply });
}
