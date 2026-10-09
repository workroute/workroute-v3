"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TABLET_OFFER_PARAGRAPHS, TABLET_OFFER_VERSION } from "@/lib/tablet-offer";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tabletOffer, setTabletOffer] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/app/welcome`,
        // Carried on the account until the business profile is created on the
        // welcome screen, which copies it onto the business (see
        // app/app/welcome/page.tsx).
        data: tabletOffer
          ? { tablet_offer_accepted_at: new Date().toISOString(), tablet_offer_version: TABLET_OFFER_VERSION }
          : undefined,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-rig-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-amber-500">
            WorkRoute
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-paper-50">
            Set up your account
          </h1>
        </div>

        <div className="rounded-lg bg-paper-50 p-6 shadow-lg">
          {status === "sent" ? (
            <div className="text-center">
              <p className="font-display font-semibold text-rig-900">Check your inbox</p>
              <p className="mt-2 text-sm text-rig-700">
                We sent a confirmation link to <span className="font-medium">{email}</span>.
                Open it on this device to finish setting up your account.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="field-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  placeholder="you@yourbusiness.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="field-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                  placeholder="At least 6 characters"
                />
              </div>

              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <label className="flex items-start gap-2 text-sm text-rig-900">
                  <input
                    type="checkbox"
                    checked={tabletOffer}
                    onChange={(e) => setTabletOffer(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-rig-700/30"
                  />
                  <span>
                    <b>Yes, I&apos;d like the free tablet offer.</b> Stay with WorkRoute for 6 months and the tablet is
                    yours. Cancel before then and you send it back.
                  </span>
                </label>
                <details className="mt-2 text-xs text-rig-700">
                  <summary className="cursor-pointer font-medium text-steel-500">Read the full offer</summary>
                  <div className="mt-2 space-y-2">
                    {TABLET_OFFER_PARAGRAPHS.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </details>
              </div>

              {status === "error" && (
                <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">
                  {errorMessage}
                </p>
              )}

              <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
                {status === "loading" ? "Creating account…" : "Create account"}
              </button>
              <p className="text-center text-xs leading-relaxed text-rig-700/70">
                By creating an account you agree to our{" "}
                <a
                  href="https://workroute.com.au/terms-and-conditions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-steel-500 underline"
                >
                  Terms and Conditions
                </a>{" "}
                and{" "}
                <a
                  href="https://workroute.com.au/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-steel-500 underline"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-rig-700">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-steel-500 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
