"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The default look suits the dark sidebar; the phone "More" page passes its own
// classes for a light background.
export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className={
        className ??
        "rounded border border-paper-50/20 px-3 py-1.5 font-display text-xs font-medium text-paper-50 hover:bg-paper-50/10"
      }
    >
      Sign out
    </button>
  );
}
