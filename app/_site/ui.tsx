import Link from "next/link";
import type { ReactNode } from "react";

// Small shared pieces for the marketing site (app/page.tsx). Kept in a private
// _site folder so none of it becomes a route.

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label="WorkRoute home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <path
          d="M16 2C10.5 2 6.5 6 6.5 11.3c0 7 9.5 17.7 9.5 17.7s9.5-10.7 9.5-17.7C25.5 6 21.5 2 16 2z"
          fill="#12A6FF"
        />
        <circle cx="16" cy="11.3" r="3.6" fill={light ? "#021F59" : "#fff"} />
      </svg>
      <span className={`font-display text-xl font-bold tracking-tight ${light ? "text-white" : "text-brand-navy"}`}>
        WorkRoute
      </span>
    </Link>
  );
}

export type IconName =
  | "phone" | "check" | "calendar" | "dollar" | "route" | "scissors" | "leaf" | "sparkle"
  | "wave" | "wrench" | "heart" | "plus" | "arrow" | "chevron" | "menu" | "close"
  | "users" | "refresh" | "message" | "star" | "file" | "bell" | "download" | "clock" | "chair";

const PATHS: Record<IconName, string> = {
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  check: "M5 13l4 4L19 7",
  calendar: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  dollar: "M12 3v18M16 7.5c-.8-1-2.2-1.5-4-1.5-2.4 0-4 1.1-4 3 0 4 8 2 8 6 0 1.9-1.6 3-4 3-1.8 0-3.2-.6-4-1.5",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6",
  scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12",
  leaf: "M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c2-4 5-7 9-9",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  wave: "M3 15c2 0 2-2 4.5-2S10 15 12 15s2.5-2 4.5-2S19 15 21 15M3 19c2 0 2-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2M7 11V5a2 2 0 0 1 4 0M15 11V5a2 2 0 0 1 4 0",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7z",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chevron: "M6 9l6 6 6-6",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4c2.1.7 3.5 2.6 3.5 5.1",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  message: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  file: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6",
  bell: "M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21a2 2 0 0 0 4 0",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  chair: "M7 4h10l1 7H6zM5 11h14v3H5zM8 14v6M16 14v6",
};

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`font-mono text-xs font-medium uppercase tracking-[0.18em] ${light ? "text-brand-sky" : "text-brand-navy/70"}`}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  light = false,
  center = false,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  light?: boolean;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <Eyebrow light={light}>{eyebrow}</Eyebrow>
      <h2 className={`mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl ${light ? "text-white" : "text-brand-ink"}`}>
        {title}
      </h2>
      {lead && <p className={`mt-4 text-base leading-relaxed sm:text-lg ${light ? "text-white/75" : "text-brand-ink/70"}`}>{lead}</p>}
    </div>
  );
}

// The app lives on its own address. Sign-up and login links are absolute so
// they land in the same place whichever domain the marketing pages are served
// from (the marketing site and the app must not each keep their own sessions).
export const APP_ORIGIN = "https://app.workroute.com.au";
export const SIGNUP_HREF = `${APP_ORIGIN}/signup`;
export const LOGIN_HREF = `${APP_ORIGIN}/login`;
export const DEMO_PHONE_DISPLAY = "07 3522 6422";
export const DEMO_PHONE_TEL = "+61735226422";
