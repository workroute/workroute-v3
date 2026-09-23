import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/clients";
import ClientDetailForm from "./client-detail-form";
import JobHistory, { type JobHistoryRow } from "./job-history";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
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

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!client) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper-50 px-4">
        <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="font-display font-semibold text-rig-900">Client not found</p>
          <p className="mt-2 text-sm text-rig-700">
            It may have been removed, or the link is out of date.
          </p>
          <Link href="/app/clients" className="btn-primary mt-4 inline-flex">
            Back to clients
          </Link>
        </div>
      </main>
    );
  }

  const { data: jobsData } = await supabase
    .from("jobs")
    .select("id, scheduled_date, created_at, status, estimated_price, quote_required, outcome")
    .eq("client_id", client.id)
    .eq("business_id", user.id)
    .order("created_at", { ascending: false });

  const jobs: JobHistoryRow[] = (jobsData ?? []).map((job) => ({
    ...job,
    trade: profile?.trade ?? null,
  }));

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="flex items-center justify-between gap-2">
          <Link href="/app/clients" className="text-sm font-medium text-steel-500 hover:underline">
            ← All clients
          </Link>
          <Link href={`/app/jobs/new?clientId=${client.id}`} className="btn-primary px-3 py-1.5 text-sm">
            + New Job
          </Link>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">{client.name}</h1>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <ClientDetailForm client={client as Client} />
        </div>

        <div className="mt-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-steel-500">
            Job history · {jobs.length}
          </p>
          <JobHistory jobs={jobs} />
        </div>
      </div>
    </main>
  );
}
