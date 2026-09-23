import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_STYLES, statusLabel, type Job as RunSheetJob } from "@/lib/run-sheet";
import { initials } from "@/lib/avatar";
import MessengerThread from "../../jobs/[id]/messenger-thread";

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

// §32 — the focused conversation view a Messages inbox row opens into.
// Deliberately trimmed to just what fast triage needs (header + thread) —
// everything else about the job (trade answers, photo, outcome actions)
// stays on /app/jobs/[id], one tap away via "View full job".
export default async function MessageThreadPage({ params }: { params: { jobId: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, customer_name, job_label, status, scheduled_date, scheduled_time, attention_priority")
    .eq("id", params.jobId)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper-50 px-4">
        <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="font-display font-semibold text-rig-900">Conversation not found</p>
          <p className="mt-2 text-sm text-rig-700">
            It may have been removed, or the link is out of date.
          </p>
          <Link href="/app/messages" className="btn-primary mt-4 inline-flex">
            Back to messages
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

  const scheduled = job.scheduled_date
    ? new Date(`${job.scheduled_date}T00:00:00`).toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }) + (job.scheduled_time ? ` · ${formatTime(job.scheduled_time)}` : "")
    : "Not yet scheduled";
  const subtitle = job.job_label ? `${job.job_label} · ${scheduled}` : scheduled;

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/messages" className="text-sm font-medium text-steel-500 hover:underline">
          ← Messages
        </Link>

        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-sm font-semibold text-rig-700">
              {initials(job.customer_name)}
            </span>
            <h1 className="font-display text-2xl font-bold text-rig-900">{job.customer_name}</h1>
          </div>
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status as RunSheetJob["status"]]}`}
          >
            {statusLabel(job.status as RunSheetJob["status"])}
          </span>
        </div>
        <p className="mt-1 pl-[52px] text-sm text-rig-700">{subtitle}</p>
        <Link
          href={`/app/jobs/${job.id}`}
          className="text-sm font-medium text-steel-500 hover:underline"
        >
          View full job →
        </Link>

        <div className="mt-6">
          <MessengerThread
            jobId={job.id}
            businessId={user.id}
            initialMessages={messagesData ?? []}
            wasFlagged={job.attention_priority !== null}
          />
        </div>
      </div>
    </main>
  );
}
