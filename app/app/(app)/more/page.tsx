import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IconCustomers, IconJobs, IconReports, IconSettings } from "../nav-icons";

// §32 — mobile-only landing spot for the sections that don't need daily,
// one-tap access (those four live directly in MobileBottomNav instead).
// Desktop doesn't need this page at all — the Sidebar already lists
// everything — but it's not gated to mobile since a direct link should
// still work regardless of viewport.
const MORE_ITEMS = [
  { href: "/app/clients", label: "Customers", description: "Who your customers are and their history", Icon: IconCustomers },
  { href: "/app/jobs", label: "Jobs", description: "Every job you've captured, regardless of status", Icon: IconJobs },
  { href: "/app/reports", label: "Reports", description: "How your business is performing", Icon: IconReports },
  { href: "/app/settings", label: "Settings", description: "How your business operates", Icon: IconSettings },
] as const;

export default async function MorePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-paper-50 pb-16 md:pb-0">
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-rig-900">More</h1>

        <div className="mt-6 space-y-3">
          {MORE_ITEMS.map(({ href, label, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm hover:bg-paper-100"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rig-900/5 text-rig-900">
                <Icon />
              </span>
              <div>
                <p className="font-display font-semibold text-rig-900">{label}</p>
                <p className="text-sm text-rig-700">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
