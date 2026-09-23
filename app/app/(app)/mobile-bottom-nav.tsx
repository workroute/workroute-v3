import Link from "next/link";
import { IconRunSheet, IconMessages, IconCalendar, IconPlus, IconMore } from "./nav-icons";

// §32 — mobile-only nav (desktop keeps the full Sidebar). Deliberately just
// the 4 daily-use destinations + quick-add, per the redesign's "every
// screen answers one question" philosophy — Customers/Jobs/Reports/Settings
// live one tap away under More rather than crowding this bar.
const ITEMS = [
  { href: "/app/run-sheet", label: "Run Sheet", Icon: IconRunSheet },
  { href: "/app/messages", label: "Messages", Icon: IconMessages },
] as const;

export default function MobileBottomNav({ needsAttentionCount }: { needsAttentionCount: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-rig-900/10 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {ITEMS.map(({ href, label, Icon }) => {
        const badge = href === "/app/messages" && needsAttentionCount > 0 ? needsAttentionCount : null;
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-rig-700"
          >
            <Icon />
            <span className="text-[11px] font-medium">{label}</span>
            {badge !== null && (
              <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-rig-950">
                {badge}
              </span>
            )}
          </Link>
        );
      })}

      <Link
        href="/app/jobs/new"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-rig-700"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-rig-950">
          <IconPlus />
        </span>
      </Link>

      <Link
        href="/app/calendar"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-rig-700"
      >
        <IconCalendar />
        <span className="text-[11px] font-medium">Calendar</span>
      </Link>

      <Link href="/app/more" className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-rig-700">
        <IconMore />
        <span className="text-[11px] font-medium">More</span>
      </Link>
    </nav>
  );
}
