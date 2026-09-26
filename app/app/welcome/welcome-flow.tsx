"use client";

import { useState } from "react";
import Link from "next/link";
import WelcomeQuickstartForm from "./welcome-quickstart-form";
import WelcomeInstall from "./welcome-install";

// §staged-onboarding — one flow, not a forced "quick start OR full setup"
// fork: everyone sees the quick 3-field form first (skipped only if a
// profile already exists, e.g. re-opening an old confirmation link after
// finishing it once), then a single confirmation screen that offers both
// "stop here for now" (via WelcomeInstall's own existing buttons) and
// "keep going into pricing" as options, not a decision that blocks either
// path.
export default function WelcomeFlow({
  userId,
  hasProfile,
  firstName,
}: {
  userId: string;
  hasProfile: boolean;
  firstName: string | null;
}) {
  const [done, setDone] = useState(hasProfile);

  if (!done) {
    return (
      <>
        <p className="font-mono text-xs uppercase tracking-widest text-amber-500">WorkRoute</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Let's get Sarah ready.</h1>
        <WelcomeQuickstartForm userId={userId} onDone={() => setDone(true)} />
      </>
    );
  }

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-amber-500">WorkRoute</p>
      <h1 className="mt-2 font-display text-3xl font-bold">
        {firstName ? `Nice one, ${firstName} — ` : ""}Sarah's set up.
      </h1>
      <p className="mt-2 max-w-sm text-sm text-paper-50/70">
        She's ready to answer, quote and book the moment your phone number's connected. Come back to Settings any
        time to fill in the rest — pricing, work hours, her voice.
      </p>
      <Link href="/app/pricing" className="mt-4 text-sm font-medium text-amber-500 hover:underline">
        Or jump straight into setting up your pricing →
      </Link>
      <WelcomeInstall />
    </>
  );
}
