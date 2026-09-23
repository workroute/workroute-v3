"use client";

import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";

const DISMISS_KEY = "workroute-install-dismissed";

export default function InstallPrompt() {
  const { isIOS, isStandalone, canInstall, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(DISMISS_KEY));
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function handleInstall() {
    await install();
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (dismissed || isStandalone || (!isIOS && !canInstall)) return null;

  return (
    <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-steel-500/20 bg-steel-500/5 p-4">
      <div>
        <p className="font-display text-sm font-semibold text-rig-900">
          Add WorkRoute to your home screen
        </p>
        {isIOS ? (
          <p className="mt-1 text-sm text-rig-700">
            Tap the Share icon in Safari, then <strong>Add to Home Screen</strong> — it opens
            full-screen with no address bar, and loads faster on site.
          </p>
        ) : (
          <p className="mt-1 text-sm text-rig-700">
            Install it for quick, full-screen access on site — no address bar, no digging for the
            browser tab.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!isIOS && (
          <button onClick={handleInstall} className="btn-primary px-3 py-2 text-sm">
            Install
          </button>
        )}
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
