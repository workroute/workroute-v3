"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function IntegrationsForm({
  userId,
  initialWebhookUrl,
}: {
  userId: string;
  initialWebhookUrl: string;
}) {
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase
      .from("business_profiles")
      .update({ zapier_webhook_url: webhookUrl || null })
      .eq("user_id", userId);

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="zapier_webhook_url" className="field-label">
          Zapier webhook URL
        </label>
        <input
          id="zapier_webhook_url"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          className="field-input"
          placeholder="https://hooks.zapier.com/hooks/catch/..."
        />
        <p className="mt-1 text-xs text-rig-700/60">
          Create a Zap with a "Webhooks by Zapier" trigger (Catch Hook), paste the URL it gives you here,
          then connect the next step to Xero, MYOB, QuickBooks, a spreadsheet — whatever you like. Every
          time a job's completion recap is sent, WorkRoute automatically sends its details there — nothing
          to do per job.
        </p>
      </div>

      {status === "error" && (
        <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
      )}
      {status === "saved" && <p className="text-sm text-moss-500">Saved.</p>}

      <button type="submit" disabled={status === "saving"} className="btn-primary w-full">
        {status === "saving" ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
