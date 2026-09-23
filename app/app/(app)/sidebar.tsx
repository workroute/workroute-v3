import Link from "next/link";
import SignOutButton from "./profile/sign-out-button";
import { initials } from "@/lib/avatar";
import {
  IconRunSheet,
  IconMessages,
  IconCustomers,
  IconJobs,
  IconCalendar,
  IconReports,
  IconSettings,
  IconSparkle,
} from "./nav-icons";

const NAV_ITEMS = [
  { href: "/app/run-sheet", label: "Run Sheet", Icon: IconRunSheet },
  { href: "/app/messages", label: "Messages", Icon: IconMessages },
  { href: "/app/clients", label: "Customers", Icon: IconCustomers },
  { href: "/app/jobs", label: "Jobs", Icon: IconJobs },
  { href: "/app/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/app/reports", label: "Reports", Icon: IconReports },
  { href: "/app/settings", label: "Settings", Icon: IconSettings },
] as const;

export default function Sidebar({
  businessName,
  firstName,
  needsAttentionCount,
}: {
  businessName: string;
  firstName: string | null;
  needsAttentionCount: number;
}) {
  return (
    // §32 — desktop-only now; mobile gets MobileBottomNav instead (see
    // app/app/(app)/layout.tsx).
    <aside className="hidden w-64 shrink-0 flex-col bg-rig-950 text-paper-50 md:flex">
      <div className="border-b border-paper-50/10 px-5 py-6">
        <p className="font-display text-lg font-bold leading-tight">{businessName || "Your business"}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const badge = href === "/app/messages" && needsAttentionCount > 0 ? needsAttentionCount : null;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-paper-50/80 transition hover:bg-paper-50/10 hover:text-paper-50"
            >
              <span className="flex items-center gap-3">
                <Icon />
                {label}
              </span>
              {badge !== null && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-rig-950">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 rounded-lg bg-paper-50/5 p-3">
        <div className="flex items-center gap-2 text-amber-500">
          <IconSparkle />
          <p className="font-display text-xs font-semibold">WorkRoute AI</p>
        </div>
        <p className="mt-1 text-xs font-medium text-paper-50/90">Your AI Secretary</p>
        <p className="mt-1 text-xs text-paper-50/60">is looking after things while you're on the tools.</p>
      </div>

      <div className="flex items-center gap-3 border-t border-paper-50/10 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-steel-500 text-sm font-semibold text-paper-50">
          {initials(firstName || businessName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-paper-50">{firstName || "Owner"}</p>
          <p className="text-xs text-paper-50/60">Owner</p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
