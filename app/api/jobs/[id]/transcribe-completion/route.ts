import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/google-speech";
import { draftCompletionRecap } from "@/lib/completion-recap-ai";

// §39 — step 1 of the voice completion recap: transcribe the tradie's
// recording and let the AI draft a summary + total. No side effects — the
// tradie reviews and edits the draft before anything is saved or sent
// (see send-completion/route.ts for that step).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const audioBase64 = body?.audioBase64;
  const sampleRateHertz = body?.sampleRateHertz;

  if (typeof audioBase64 !== "string" || typeof sampleRateHertz !== "number") {
    return NextResponse.json({ ok: false, error: "Missing recording." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("customer_name, job_label, estimated_price, scheduled_date, scheduled_time")
    .eq("id", params.id)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }

  const transcription = await transcribeAudio(audioBase64, sampleRateHertz);
  if (!transcription.ok) {
    return NextResponse.json({ ok: false, error: transcription.error }, { status: 502 });
  }

  const draft = await draftCompletionRecap(transcription.transcript, {
    customerName: job.customer_name,
    jobLabel: job.job_label,
    quotedPrice: job.estimated_price !== null ? Number(job.estimated_price) : null,
    scheduledDate: job.scheduled_date,
    scheduledTime: job.scheduled_time,
  });

  if (!draft.ok) {
    return NextResponse.json(
      { ok: false, error: draft.error, transcript: transcription.transcript },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    transcript: transcription.transcript,
    summary: draft.summary,
    total: draft.total,
    nextVisitRequested: draft.nextVisitRequested,
    nextVisitDate: draft.nextVisitDate,
    nextVisitTime: draft.nextVisitTime,
  });
}
