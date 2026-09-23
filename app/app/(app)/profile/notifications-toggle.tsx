"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";

// Opt-in push for high-priority Messenger flags and bad-weather warnings —
// SMS stays the reliable fallback for the same events, this is layered on
// top. Renders nothing where push isn't supported at all (e.g. iOS Safari
// not installed to home screen).
export default function NotificationsToggle({ userId }: { userId: string }) {
  const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = usePushSubscription();
  const [busy, setBusy] = useState(false);

  if (!isSupported) return null;

  async function handleEnable() {
    setBusy(true);
    await subscribe(async (sub) => {
      const supabase = createClient();
      await supabase.from("owner_push_subscriptions").upsert(
        { business_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        { onConflict: "business_id,endpoint" }
      );
    });
    setBusy(false);
  }

  // Removes only this device's row, so switching devices/browsers over time
  // doesn't leave old subscriptions behind sending duplicate notifications
  // forever — see lib/push.ts, which only cleans up a row once the push
  // service itself reports it dead.
  async function handleDisable() {
    setBusy(true);
    await unsubscribe(async (endpoint) => {
      const supabase = createClient();
      await supabase
        .from("owner_push_subscriptions")
        .delete()
        .eq("business_id", userId)
        .eq("endpoint", endpoint);
    });
    setBusy(false);
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-steel-500">Notifications</p>
      <p className="mt-1 text-sm text-rig-700">
        Get an instant alert on this device for urgent messages and bad-weather warnings — on top
        of the usual SMS, not instead of it.
      </p>
      <div className="mt-3">
        {permission === "denied" && (
          <p className="text-sm text-rig-700/60">
            Notifications are blocked — enable them in your browser settings.
          </p>
        )}
        {permission === "granted" && isSubscribed && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-moss-500">Notifications are enabled on this device.</p>
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy}
              className="text-sm text-rig-700/60 underline"
            >
              {busy ? "Disabling…" : "Disable"}
            </button>
          </div>
        )}
        {permission !== "denied" && !isSubscribed && (
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className="btn-primary px-3 py-2 text-sm"
          >
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
        )}
      </div>
    </div>
  );
}
