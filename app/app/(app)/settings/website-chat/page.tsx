import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WebsiteChatForm from "./website-chat-form";

// §Website Widget — widget_key is server-generated (default gen_random_uuid()
// on business_profiles, see supabase/migrations/0016_website_widget.sql) —
// unlike the Vapi phone number, there's nothing for the tradie to type in or
// provision externally, so this page is mostly read-only + copy.
export default async function WebsiteChatSettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("widget_key")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-paper-50 pb-16 md:pb-0">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/settings" className="text-sm font-medium text-steel-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">Website Chat</h1>
        <p className="mt-1 text-sm text-rig-700">
          Add Sarah to your own business website — she'll capture leads from visitors 24/7 and they land straight
          in your Jobs list, same as a phone enquiry.
        </p>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <WebsiteChatForm widgetKey={profile?.widget_key ?? ""} />
        </div>
      </div>
    </main>
  );
}
