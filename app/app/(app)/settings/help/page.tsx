import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HelpPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/settings" className="text-sm font-medium text-steel-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">Help & support</h1>

        <div className="mt-6 space-y-4 rounded-lg bg-white p-6 shadow-sm text-sm text-rig-700">
          <p>Need a hand, or found something that's not working right?</p>
          <p>
            Email{" "}
            <a href="mailto:support@workroute.com.au" className="font-medium text-steel-500 hover:underline">
              support@workroute.com.au
            </a>{" "}
            and we'll get back to you.
          </p>
        </div>
      </div>
    </main>
  );
}
