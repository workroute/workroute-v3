import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TRADE_QUESTIONS } from "@/lib/trade-questions";
import { STATUS_STYLES, statusLabel, type Job as RunSheetJob } from "@/lib/run-sheet";
import { initials } from "@/lib/avatar";
import OutcomeActions from "./outcome-actions";
import RescheduleAction from "./reschedule-action";
import MessengerThread from "./messenger-thread";
import JobTabs from "./job-tabs";
import CompletionRecap from "./completion-recap";
import QuoteCompletionForm from "./quote-completion-form";
import JobPhotos from "./job-photos";
import InvoicePaidToggle from "./invoice-paid-toggle";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card / Eftpos",
  payid: "PayID",
  bank_transfer: "Bank transfer",
  invoice_later: "Invoice later",
};

function formatAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("business_name, trade")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", params.id)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper-50 px-4">
        <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="font-display font-semibold text-rig-900">Job not found</p>
          <p className="mt-2 text-sm text-rig-700">
            It may have been removed, or the link is out of date.
          </p>
          <Link href="/app/run-sheet" className="btn-primary mt-4 inline-flex">
            Back to run sheet
          </Link>
        </div>
      </main>
    );
  }

  const { data: messagesData } = await supabase
    .from("messages")
    .select("id, sender, body, created_at")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });

  // §25 — audit trail for AI phone intake: "Captured by AI intake,
  // [timestamp]" plus the full transcript underneath, same principle as
  // §24's Messenger message log.
  let phoneCapture: { transcript_text: string | null; transcript_messages: { role: string; message: string }[]; created_at: string } | null = null;
  if (job.source === "call") {
    const { data } = await supabase
      .from("phone_call_captures")
      .select("transcript_text, transcript_messages, created_at")
      .eq("job_id", job.id)
      .maybeSingle();
    phoneCapture = data;
  }

  let clientNotes: string | null = null;
  if (job.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("notes")
      .eq("id", job.client_id)
      .maybeSingle();
    clientNotes = client?.notes ?? null;
  }

  let photoUrl: string | null = null;
  if (job.arrival_photo_path) {
    const { data: signed } = await supabase.storage
      .from("job-photos")
      .createSignedUrl(job.arrival_photo_path, 60 * 10);
    photoUrl = signed?.signedUrl ?? null;
  }

  let completionPhotoUrl: string | null = null;
  if (job.completion_photo_path) {
    const { data: signed } = await supabase.storage
      .from("job-photos")
      .createSignedUrl(job.completion_photo_path, 60 * 10);
    completionPhotoUrl = signed?.signedUrl ?? null;
  }

  const questions = TRADE_QUESTIONS[profile?.trade ?? ""] ?? [];
  const address = [job.address_street, job.address_suburb, job.address_postcode]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/run-sheet" className="text-sm font-medium text-steel-500 hover:underline">
          ← Run sheet
        </Link>

        <div className="mt-2 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-sm font-semibold text-rig-700">
            {initials(job.customer_name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-display text-2xl font-bold text-rig-900">{job.customer_name}</h1>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status as RunSheetJob["status"]]}`}
              >
                {statusLabel(job.status as RunSheetJob["status"])}
              </span>
            </div>
            {job.job_label && <p className="text-sm text-rig-700">{job.job_label}</p>}
          </div>
        </div>

        {/* §20 — outcome (Won/Lost/Declined), separate from job status above.
            §32 — Reschedule lives here too now, moved off the run sheet card. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <OutcomeActions
            jobId={job.id}
            status={job.status as RunSheetJob["status"]}
            initialOutcome={job.outcome as RunSheetJob["outcome"]}
          />
          {job.status !== "Unscheduled" && job.status !== "Completed" && (
            <RescheduleAction job={job as RunSheetJob} />
          )}
        </div>

        {job.status === "Completed" && (
          <div className="mt-4">
            {job.quote_required && !job.quote_given_at ? (
              <QuoteCompletionForm jobId={job.id} />
            ) : (
              <CompletionRecap
                jobId={job.id}
                businessId={user.id}
                initialSummary={job.completion_summary}
                initialSentAt={job.completion_sent_at}
                customerEmail={job.customer_email}
              />
            )}
          </div>
        )}

        <JobTabs
          details={
            <div className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-rig-700/60">Duration</p>
                  <p className="mt-0.5 text-rig-900">
                    {job.estimated_duration_minutes ? `${job.estimated_duration_minutes} min` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-rig-700/60">Price</p>
                  <p className="mt-0.5 text-rig-900">
                    {job.quote_required && job.quoted_price !== null
                      ? `$${Number(job.quoted_price).toFixed(2)} (quoted)`
                      : job.quote_required
                        ? "Quote required"
                        : job.estimated_price !== null
                          ? `$${Number(job.estimated_price).toFixed(2)}`
                          : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-rig-700/60">Confidence</p>
                  <p className="mt-0.5 text-rig-900">{job.confidence}</p>
                </div>
              </div>

              {job.payment_collected_method && (
                <div className="border-t border-rig-900/10 pt-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-rig-700/60">Payment</p>
                  <p className="mt-0.5 text-rig-900">
                    {PAYMENT_METHOD_LABELS[job.payment_collected_method] ?? job.payment_collected_method}
                  </p>
                  {(job.payment_collected_method === "bank_transfer" || job.payment_collected_method === "invoice_later") && (
                    <InvoicePaidToggle jobId={job.id} initialPaidAt={job.invoice_paid_at} />
                  )}
                </div>
              )}

              {job.recurring_frequency && (
                <p className="rounded bg-steel-500/10 px-3 py-2 text-sm text-steel-500">
                  🔁 Part of a {job.recurring_frequency.toLowerCase()} recurring series — future visits were booked
                  at the same time.
                </p>
              )}

              <div className="border-t border-rig-900/10 pt-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-rig-700/60">Source</p>
                <p className="mt-0.5 text-rig-900">{job.source}</p>
              </div>

              {phoneCapture && (
                <div className="border-t border-rig-900/10 pt-4 text-sm">
                  <p className="font-medium text-rig-900">
                    Captured by AI intake,{" "}
                    {new Date(phoneCapture.created_at).toLocaleString("en-AU", {
                      timeZone: "Australia/Brisbane",
                    })}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-steel-500 hover:underline">
                      View call transcript
                    </summary>
                    <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded border border-rig-700/20 bg-paper-100 p-3">
                      {phoneCapture.transcript_messages?.length > 0 ? (
                        phoneCapture.transcript_messages.map((m, i) => (
                          <p key={i} className="text-xs text-rig-700">
                            <span className="font-medium text-rig-900">{m.role === "user" ? "Caller: " : "AI: "}</span>
                            {m.message}
                          </p>
                        ))
                      ) : (
                        <p className="whitespace-pre-wrap text-xs text-rig-700">
                          {phoneCapture.transcript_text || "Transcript not available yet — the call may still be in progress."}
                        </p>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {questions.length > 0 && (
                <div className="border-t border-rig-900/10 pt-4">
                  <p className="mb-2 font-mono text-xs uppercase tracking-widest text-steel-500">
                    {profile?.trade} details
                  </p>
                  <div className="space-y-2 text-sm">
                    {questions.map((q) => (
                      <div key={q.id} className="flex justify-between gap-4">
                        <span className="text-rig-700">{q.label}</span>
                        <span className="text-right text-rig-900">
                          {formatAnswer(job.trade_answers?.[q.id])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <JobPhotos
                jobId={job.id}
                businessId={user.id}
                arrivalPhotoUrl={photoUrl}
                arrivalPhotoTakenAt={job.arrival_photo_taken_at}
                completionPhotoUrl={completionPhotoUrl}
                completionPhotoTakenAt={job.completion_photo_taken_at}
              />
            </div>
          }
          customer={
            <div className="space-y-4 rounded-lg bg-white p-6 text-sm shadow-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-rig-700/60">Contact</p>
                <p className="mt-0.5 text-rig-900">{job.customer_phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-rig-700/60">Address</p>
                <p className="mt-0.5 text-rig-900">{address || "—"}</p>
              </div>
              {job.client_id && (
                <Link
                  href={`/app/clients/${job.client_id}`}
                  className="inline-block font-medium text-steel-500 hover:underline"
                >
                  View client profile →
                </Link>
              )}
            </div>
          }
          notes={
            <div className="rounded-lg bg-white p-6 text-sm shadow-sm">
              {clientNotes ? (
                <p className="whitespace-pre-wrap text-rig-900">{clientNotes}</p>
              ) : (
                <p className="text-rig-700/60">
                  {job.client_id ? "No notes on this customer yet." : "This job isn't linked to a customer record."}
                </p>
              )}
              {job.client_id && (
                <Link
                  href={`/app/clients/${job.client_id}`}
                  className="mt-3 inline-block font-medium text-steel-500 hover:underline"
                >
                  Edit on client profile →
                </Link>
              )}
            </div>
          }
          history={
            <MessengerThread
              jobId={job.id}
              businessId={user.id}
              initialMessages={messagesData ?? []}
              wasFlagged={job.attention_priority !== null}
            />
          }
        />
      </div>
    </main>
  );
}
