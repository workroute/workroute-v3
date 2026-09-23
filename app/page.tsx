// TEMPORARY PLACEHOLDER — replace wholesale with the marketing page.
// The real app now lives at /app. Do not add product logic here.
// See MARKETING_INTEGRATION.md for what the real marketing page needs to know
// (including the logged-in redirect below — keep that check in the real page).
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/supabase/auth";

export default async function PlaceholderHome() {
  const {
    data: { user },
  } = await getAuthedUser();

  if (user) {
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-rig-900 px-4 text-center text-paper-50">
      <p className="font-mono text-xs uppercase tracking-widest text-amber-500">WorkRoute</p>
      <h1 className="font-display text-3xl font-bold">Job capture for tradies.</h1>
      <div className="flex gap-4">
        <a href="/signup" className="btn-primary px-6 py-3">
          JOIN NOW
        </a>
        <a href="/login" className="px-6 py-3 text-steel-500 underline">
          LOG IN
        </a>
      </div>
    </main>
  );
}
