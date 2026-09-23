"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

              {status === "error" && (
                <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">
                  {errorMessage}
                </p>
              )}

              <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
                {status === "loading" ? "Creating account…" : "Create account"}
              </button>
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
