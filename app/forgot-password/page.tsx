"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Sends a Supabase recovery link to the given email. Always shows the same
// success message regardless of whether the address has an account — an
// error here would let anyone probe which emails are registered.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    // Rate-limit errors are the one thing worth surfacing distinctly — every
    // other failure mode (bad email format aside) still resolves to the same
    // generic "check your inbox" message, so as not to reveal whether an
    // account exists for that address.
    if (error && error.status !== 429) {
      setStatus("sent");
      return;
    }
    if (error) {
      setStatus("error");
      setErrorMessage("Too many attempts — please wait a few minutes and try again.");
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-rig-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-amber-500">WorkRoute</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-paper-50">Reset your password</h1>
        </div>

        <div className="rounded-lg bg-paper-50 p-6 shadow-lg">
          {status === "sent" ? (
            <div className="text-center">
              <p className="font-display font-semibold text-rig-900">Check your inbox</p>
              <p className="mt-2 text-sm text-rig-700">
                If an account exists for <span className="font-medium">{email}</span>, we've sent a link to reset
                your password.
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

              {status === "error" && (
                <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
              )}

              <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
                {status === "loading" ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-rig-700">
            <Link href="/login" className="font-medium text-steel-500 hover:underline">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
