import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationsToggle from "../../profile/notifications-toggle";

export default async function SettingsNotificationsPage() {
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
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">Notifications</h1>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <NotificationsToggle userId={user.id} />
        </div>
      </div>
    </main>
  );
}
