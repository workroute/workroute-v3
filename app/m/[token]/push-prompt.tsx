"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";

const DISMISS_KEY = "workroute-push-dismissed";

// Structurally mirrors app/app/(app)/install-prompt.tsx's dismissible-
// banner pattern. Opt-in only — SMS keeps working as the reliable fallback
// whether or not this is ever enabled, especially for iOS customers who
// haven't installed the page to their home screen (push doesn't work in a
// plain Safari tab there).
export default function PushPrompt({ token }: { token: string }) {
  const { isSupported, permission, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(DISMISS_KEY));
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function handleEnable() {
    await subscribe(async (sub) => {
      const supabase = createClient();
      await supabase.rpc("messenger_save_push_subscription", {
        p_token: token,
        p_endpoint: sub.endpoint,
        p_p256dh: sub.keys.p256dh,
        p_auth: sub.keys.auth,
      });
    });
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (dismissed || !isSupported || permission !== "default") return null;

  return (
    <div className="flex items-start justify-between gap-3 border-b border-rig-900/10 bg-steel-500/5 px-4 py-3">
      <p className="text-xs text-rig-700">Get notified here when there's a new reply.</p>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={handleEnable} className="btn-primary px-2.5 py-1 text-xs">
          Enable
        </button>
        <button
          onClick={dismiss}
          className="rounded p-1 text-rig-700/60 hover:text-rig-700"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
