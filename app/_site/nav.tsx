"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, LOGIN_HREF, Logo, SIGNUP_HREF } from "./ui";

const LINKS = [
  { href: "/#who", label: "Who it's for" },
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-navy/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo light />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-white/75 transition hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href={LOGIN_HREF} className="text-sm font-medium text-white/80 transition hover:text-white">
            Log in
          </Link>
          <Link
            href={SIGNUP_HREF}
            className="rounded-full bg-brand-sky px-5 py-2 font-display text-sm font-semibold text-brand-deep transition hover:bg-white"
          >
            Start free trial
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-white md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? "close" : "menu"} className="h-6 w-6" />
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-brand-navy px-4 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-white/10 py-3 text-base font-medium text-white/85"
              >
                {l.label}
              </a>
            ))}
            <Link href={LOGIN_HREF} className="border-b border-white/10 py-3 text-base font-medium text-white/85">
              Log in
            </Link>
          </nav>
          <Link
            href={SIGNUP_HREF}
            className="mt-4 block rounded-full bg-brand-sky px-5 py-3 text-center font-display font-semibold text-brand-deep"
          >
            Start free trial
          </Link>
        </div>
      )}
    </header>
  );
}
