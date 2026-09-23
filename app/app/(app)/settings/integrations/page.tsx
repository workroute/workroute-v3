import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import IntegrationsForm from "./integrations-form";

// §55 — the Zapier webhook is the low-effort way to get real accounting
// sync (Xero, MYOB, QuickBooks, whatever) without WorkRoute building a
// bespoke direct integration with any one of them — Zapier already has
// mature connectors for all of them, WorkRoute just needs to fire one
// generic webhook.
export default async function IntegrationsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("zapier_webhook_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/settings" className="text-sm font-medium text-steel-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">Integrations</h1>
        <p className="mt-1 text-sm text-rig-700">
          Send completed job details straight to your accounting software or anywhere else, automatically.
        </p>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <IntegrationsForm userId={user.id} initialWebhookUrl={profile?.zapier_webhook_url ?? ""} />
        </div>
      </div>
    </main>
  );
}
