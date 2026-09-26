import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IconBuilding, IconBell, IconClock, IconPlug, IconPhone, IconMessages, IconHelp, IconReactivate, IconMic, IconOverview } from "../nav-icons";

// §32e — Settings as its own hub, separate from just linking straight to
// /app/profile. Business details still lives at /app/profile (untouched,
// including its own inline Notifications/Pricing cards — this hub adds
// dedicated destinations alongside that, it doesn't remove the old ones).
const SETTINGS_ITEMS = [
  { href: "/app/profile", label: "Business details", description: "Your business information", Icon: IconBuilding },
  { href: "/app/settings/notifications", label: "Notifications", description: "Manage alerts & sounds", Icon: IconBell },
  { href: "/app/settings/work-hours", label: "Work hours", description: "Set your available hours", Icon: IconClock },
  { href: "/app/settings/phone-ai", label: "Phone AI", description: "Connected number & VIP alerts", Icon: IconPhone },
  { href: "/app/settings/voice", label: "Voice", description: "Choose your AI's voice & name", Icon: IconMic },
  { href: "/app/settings/reactivation-calling", label: "Reactivation calling", description: "Have Sarah call lapsed clients", Icon: IconReactivate },
  { href: "/app/settings/website-chat", label: "Website Chat", description: "Add Sarah to your site", Icon: IconMessages },
  { href: "/app/settings/integrations", label: "Integrations", description: "Connected services", Icon: IconPlug },
  { href: "/app/settings/help", label: "Help & support", description: "Get help or contact us", Icon: IconHelp },
] as const;

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.id === process.env.ADMIN_USER_ID;
  const items = isAdmin
    ? [
        ...SETTINGS_ITEMS,
        {
          href: "/app/admin/overview",
          label: "Owner overview",
          description: "Every business, at a glance",
          Icon: IconOverview,
        },
      ]
    : SETTINGS_ITEMS;

  return (
    <main className="min-h-screen bg-paper-50 pb-16 md:pb-0">
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-rig-900">Settings</h1>

        <div className="mt-6 space-y-3">
          {items.map(({ href, label, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm hover:bg-paper-100"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rig-900/5 text-rig-900">
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-rig-900">{label}</p>
                <p className="text-sm text-rig-700">{description}</p>
              </div>
              <span className="text-rig-700/40" aria-hidden="true">
                ›
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
