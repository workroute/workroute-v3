"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";

export default function WelcomeInstall() {
  const router = useRouter();
  const { isIOS, isStandalone, canInstall, install } = useInstallPrompt();

  useEffect(() => {
    // Already inside the installed app somehow (e.g. reopening an old
    // confirmation link) — nothing to show, just continue in.
    if (isStandalone) {
      router.replace("/app");
    }
  }, [isStandalone, router]);

  async function handleInstall() {
    await install();
    router.push("/app");
  }

  function continueToApp() {
    router.push("/app");
  }

  if (isStandalone) return null;

  return (
    <div className="mt-6 w-full max-w-sm">
      <p className="text-2xl">📱</p>
      <p className="mt-3 font-display text-lg font-semibold">Add WorkRoute to your phone</p>
      <p className="mt-2 text-sm text-paper-50/70">
        So your schedule, customers and messages are always one tap away.
      </p>

      {isIOS ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-lg bg-paper-50/5 p-4 text-left text-sm text-paper-50/90">
            Tap the <strong>Share</strong> icon in Safari, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
          <button onClick={continueToApp} className="btn-primary w-full">
            Continue to WorkRoute
          </button>
        </div>
      ) : canInstall ? (
        <div className="mt-6 space-y-3">
          <button onClick={handleInstall} className="btn-primary w-full">
            Install WorkRoute
          </button>
          <button
            onClick={continueToApp}
            className="w-full text-sm text-paper-50/60 hover:text-paper-50/90"
          >
            Skip for now
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <button onClick={continueToApp} className="btn-primary w-full">
            Continue to WorkRoute
          </button>
          <p className="mt-3 text-xs text-paper-50/50">
            You can install WorkRoute later from your browser's menu.
          </p>
        </div>
      )}
    </div>
  );
}
