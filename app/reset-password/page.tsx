"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Landed on after clicking the email link from /forgot-password — by the
// time this renders, app/auth/callback/route.ts has already exchanged the
// recovery code for a real (short-lived) session, so updateUser below just
// needs that session to still be present in the browser client's cookies.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setHasSession(!!data.user));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords don't match.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-rig-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-amber-500">WorkRoute</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-paper-50">Set a new password</h1>
        </div>

        <div className="rounded-lg bg-paper-50 p-6 shadow-lg">
          {hasSession === false ? (
            <div className="text-center">
              <p className="font-display font-semibold text-rig-900">Link expired or invalid</p>
              <p className="mt-2 text-sm text-rig-700">
                This reset link is no longer valid. Request a new one to continue.
              </p>
              <Link href="/forgot-password" className="btn-primary mt-4 inline-block">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="field-label">
                  New password
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

              <div>
                <label htmlFor="confirmPassword" className="field-label">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="field-input"
                  placeholder="Re-enter your new password"
                />
              </div>

              {status === "error" && (
                <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
              )}

              <button
                type="submit"
                disabled={status === "loading" || hasSession === null}
                className="btn-primary w-full"
              >
                {status === "loading" ? "Saving…" : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
