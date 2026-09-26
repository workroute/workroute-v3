import { redirect } from "next/navigation";
import { getAuthedUser, getBusinessProfile } from "@/lib/supabase/auth";
import WelcomeFlow from "./welcome-flow";

// One-time post-signup onboarding screen — the only place `?next=` from
// the email-confirmation link ever points at. Deliberately sits outside
// the app/(app) route group, so it renders with no sidebar. §staged-
// onboarding — now a real quick-start form (see welcome-flow.tsx) rather
// than just a PWA install prompt, since first_name/business_name/trade
// weren't being asked for anywhere before a tradie landed in the app.
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
      <WelcomeFlow userId={user.id} hasProfile={!!profile} firstName={profile?.first_name ?? null} />
    </main>
  );
}
