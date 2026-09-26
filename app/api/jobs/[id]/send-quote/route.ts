import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendSms as sendTextMessage } from "@/lib/mobile-message";
import { messageFor } from "@/lib/notifications";

// §quote-followup — the completion step for a quote visit (quote_required
// = true), distinct from send-completion: no invoice number burned, no
// payment method asked, since nothing's actually been sold yet. Just
// records the on-site price and lets Sarah's follow-up call (see
// lib/quote-followup.ts) pick it up from there.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const quotedPrice = Number(body?.quotedPrice);
  const summary = typeof body?.summary === "string" ? body.summary : null;

  if (!Number.isFinite(quotedPrice) || quotedPrice < 0) {
    return NextResponse.json({ ok: false, error: "Enter a valid quote amount." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, quote_required, customer_name, customer_phone, customer_access_token, job_label")
    .eq("id", params.id)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }
  if (!job.quote_required) {
    return NextResponse.json({ ok: false, error: "This job isn't flagged as needing a quote." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("business_name, first_name")
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase
    .from("jobs")
    .update({
      quote_given_at: new Date().toISOString(),
      quoted_price: quotedPrice,
      completion_summary: summary,
    })
    .eq("id", job.id);

  let smsResult: { ok: boolean; error?: string } | null = null;
  if (job.customer_phone) {
    const messengerLink = `${new URL(request.url).origin}/m/${job.customer_access_token}`;
    const message = messageFor(
      "quote_given",
      job.customer_name,
      profile?.first_name ?? null,
      profile?.business_name || "Your tradie",
      messengerLink,
      null,
      null,
      null,
      null,
      { amount: quotedPrice, jobLabel: job.job_label }
    );
    smsResult = await sendTextMessage(job.customer_phone, message);

    await supabase.from("messages").insert({
      job_id: job.id,
      business_id: user.id,
      sender: "tradie",
      body: `Quote given: $${quotedPrice.toFixed(2)}${job.job_label ? ` for ${job.job_label}` : ""}.${summary ? `\n\n${summary}` : ""}`,
    });
  }

  return NextResponse.json({ ok: true, sms: smsResult });
}
