import { redirect } from "next/navigation";
import { getAuthedUser, getBusinessProfile } from "@/lib/supabase/auth";
import WelcomeInstall from "./welcome-install";

// One-time post-signup onboarding screen — the only place `?next=` from
// the email-confirmation link ever points at. Deliberately sits outside
// the app/(app) route group, so it renders with no sidebar.
export default async function WelcomePage() {
  const {
    data: { user },
  } = await getAuthedUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await getBusinessProfile(user.id);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-rig-900 px-4 text-center text-paper-50">
      <p className="font-mono text-xs uppercase tracking-widest text-amber-500">WorkRoute</p>
      <h1 className="mt-2 font-display text-3xl font-bold">
        {profile?.first_name ? `Nice one, ${profile.first_name} — ` : ""}WorkRoute is ready.
      </h1>
      <WelcomeInstall />
    </main>
  );
}
