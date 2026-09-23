import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/clients";
import ClientsTable, { type ClientRow } from "./clients-table";

export default async function ClientsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clientsData } = await supabase
    .from("clients")
    .select("*")
    .eq("business_id", user.id)
    .order("name");

  const clients = (clientsData ?? []) as Client[];

  const { data: jobsData } = await supabase
    .from("jobs")
    .select("client_id, scheduled_date, created_at")
    .eq("business_id", user.id)
    .not("client_id", "is", null);

  const jobCount = new Map<string, number>();
  const lastJobDate = new Map<string, string>();
  for (const job of jobsData ?? []) {
    const id = job.client_id as string;
    jobCount.set(id, (jobCount.get(id) ?? 0) + 1);
    const date = job.scheduled_date ?? job.created_at.slice(0, 10);
    if (!lastJobDate.has(id) || date > lastJobDate.get(id)!) {
      lastJobDate.set(id, date);
    }
  }

  const rows: ClientRow[] = clients.map((client) => ({
    ...client,
    job_count: jobCount.get(client.id) ?? 0,
    last_job_date: lastJobDate.get(client.id) ?? null,
  }));

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-rig-900">Customers</h1>
            <p className="mt-1 text-sm text-rig-700">
              Regular customers, remembered — not a pipeline, just a record.
            </p>
          </div>
          <Link href="/app/clients/new" className="btn-primary whitespace-nowrap">
            Add client
          </Link>
        </div>

        <ClientsTable rows={rows} />
      </div>
    </main>
  );
}
