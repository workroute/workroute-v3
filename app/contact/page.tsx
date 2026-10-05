import type { Metadata } from "next";
import Nav from "../_site/nav";
import { SiteFooter } from "../_site/sections";
import { DEMO_PHONE_DISPLAY, DEMO_PHONE_TEL, Eyebrow, Icon, SIGNUP_HREF } from "../_site/ui";

export const metadata: Metadata = {
  title: "Contact | WorkRoute",
  description: "Get in touch with WorkRoute, or ring Sarah to hear how she answers the phone.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="bg-white text-brand-ink">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Eyebrow>Contact</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-brand-ink">Get in touch</h1>
        <p className="mt-4 text-lg leading-relaxed text-brand-ink/70">
          Questions about WorkRoute, or want it set up for your trade? Steve, the founder, reads every message.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a href="mailto:steve@workroute.com.au" className="rounded-2xl border border-brand-navy/10 p-5 transition hover:shadow-md">
            <p className="font-display text-sm font-semibold text-brand-navy">Email</p>
            <p className="mt-1 text-brand-ink">steve@workroute.com.au</p>
          </a>
          <a href={`tel:${DEMO_PHONE_TEL}`} className="rounded-2xl border border-brand-navy/10 p-5 transition hover:shadow-md">
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-brand-navy">
              <Icon name="phone" className="h-4 w-4" />
              Ring Sarah
            </p>
            <p className="mt-1 text-brand-ink">{DEMO_PHONE_DISPLAY}</p>
            <p className="mt-1 text-sm text-brand-ink/60">Hear how she answers, and ask her anything.</p>
          </a>
        </div>

        <p className="mt-10 text-sm text-brand-ink/60">
          Ready to try it?{" "}
          <a href={SIGNUP_HREF} className="font-semibold text-brand-navy underline">
            Start your free trial
          </a>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
