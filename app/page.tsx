// WorkRoute marketing homepage. Keep the logged-in redirect at the top: someone
// who types the bare domain while signed in goes straight to the app (see
// MARKETING_INTEGRATION.md). JOIN NOW → /signup, LOG IN → /login.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/supabase/auth";
import Nav from "./_site/nav";
import Demo from "./_site/demo";
import {
  BASE_FAQ,
  FaqSection,
  FinalCta,
  HowItWorks,
  MeetSarah,
  MissedCallBand,
  PricingSection,
  SarahChat,
  SiteFooter,
} from "./_site/sections";
import { TRADE_PAGES } from "./_site/trades";
import { JsonLd, ORGANIZATION, SOFTWARE, WEBSITE, faqPage } from "./_site/jsonld";
import { DEMO_PHONE_DISPLAY, DEMO_PHONE_TEL, Eyebrow, Icon, SIGNUP_HREF, SectionHeading } from "./_site/ui";

export const metadata: Metadata = {
  title: "WorkRoute | AI receptionist for tradies and local services",
  alternates: { canonical: "/" },
  description:
    "Sarah answers every call, quotes a real price and books a real time in your diary. Built for tradies, hairdressers, massage and other local services. 14-day free trial.",
  openGraph: {
    title: "WorkRoute | You do the work. Sarah runs the office.",
    description: "An AI receptionist and diary for tradies and local services. Never miss a booking.",
    type: "website",
  },
};

const WHO_TEXT: Record<string, string> = {
  "lawn-care": "Real prices from your lawn-size rates and a day's run planned around real driving time. Landscaping projects get a site visit booked for a quote.",
  cleaning: "Quotes by home size and extras, with regular visits booked weeks ahead.",
  "pool-care": "Quoted by pool size, type and condition, with regulars booked in automatically.",
  mechanics: "Your price for each job, adjusted for brand, fuel and vehicle type.",
  hairdressers: "Men's, women's and kids' cuts, colour and more, with a price and a time for each. Preferred stylist, several chairs at once.",
  massage: "Session lengths, preferred therapist and health notes. No address and no travel.",
};

const SALON_POINTS = [
  "Sarah answers while you're mid-cut, so nobody has to stop and grab the phone",
  "A price and a time for every service: men's, women's, kids', colour and more",
  "Preferred stylist, and several chairs booked at the same time",
  "Rebook a regular quickly, and add walk-ins in a moment",
  "A cancellation? Sarah offers the time to clients booked later in the week. First to tap gets it.",
];

const TRADIE_POINTS = [
  "Smart Route plans the day using real driving time between jobs",
  "On My Way texts your customer a calculated ETA. Delay sends a quick update.",
  "Talk through the job and WorkRoute writes the record and a numbered invoice",
  "Chases unpaid invoices and asks happy customers for a Google review",
  "Kilometre records between jobs (supporting records, not a formal ATO logbook)",
];

const FEATURES = [
  { icon: "phone", name: "AI phone receptionist", replaces: "an answering service" },
  { icon: "dollar", name: "Real prices, live on the call", replaces: "calling back with a quote later" },
  { icon: "calendar", name: "Smart booking and availability", replaces: "a booking calendar" },
  { icon: "refresh", name: "Recurring visits booked ahead", replaces: "a subscription scheduler" },
  { icon: "users", name: "Full customer history", replaces: "a CRM" },
  { icon: "check", name: "Recognises returning callers", replaces: "looking up who's calling" },
  { icon: "message", name: "Website chat widget", replaces: "a chat widget subscription" },
  { icon: "message", name: "Customer messages", replaces: "a business texting app" },
  { icon: "bell", name: "VIP caller alerts", replaces: "screening calls yourself" },
  { icon: "refresh", name: "Win-back calling of past clients", replaces: "a retention campaign" },
  { icon: "star", name: "Google review requests", replaces: "a review-request tool" },
  { icon: "file", name: "Numbered invoices and unpaid-invoice chasing", replaces: "invoicing software" },
  { icon: "download", name: "Xero, MYOB, QuickBooks and Zapier", replaces: "manual data entry" },
  { icon: "clock", name: "Installs on your phone like an app", replaces: "a native app build" },
  { icon: "download", name: "Download your customer list any time", replaces: "being locked in" },
] as const;

export default async function HomePage() {
  const {
    data: { user },
  } = await getAuthedUser();

  if (user) {
    redirect("/app");
  }

  return (
    <div className="bg-white text-brand-ink">
      <JsonLd data={[ORGANIZATION, WEBSITE, SOFTWARE, faqPage(BASE_FAQ)]} />
      <Nav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-navy to-brand-deep text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-brand-sky/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr,0.95fr] lg:py-24">
            <div>
              <Eyebrow light>AI receptionist for tradies and local services</Eyebrow>
              <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                You do the work.
                <br />
                <span className="text-brand-sky">Sarah runs the office.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
                Meet Sarah, your AI office manager. She answers every call, quotes a real price, books a real time in your
                diary and keeps clients in the loop, while you cut, mow, landscape, clean or fix.
              </p>
              <p className="mt-3 max-w-xl text-lg font-medium leading-relaxed text-white">
                Sarah picks up the call and books the job straight away, so your customer never waits for a text back.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={SIGNUP_HREF}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-sky px-7 py-3.5 font-display text-base font-semibold text-brand-deep transition hover:bg-white"
                >
                  Start your free trial
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
                <a
                  href={`tel:${DEMO_PHONE_TEL}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-7 py-3.5 font-display text-base font-semibold text-white transition hover:border-white hover:bg-white/10"
                >
                  <Icon name="phone" className="h-4 w-4" />
                  Hear Sarah: {DEMO_PHONE_DISPLAY}
                </a>
              </div>
              <p className="mt-4 text-sm text-white/60">14-day free trial · No lock-in · Australian voice</p>
            </div>

            <Demo />
          </div>
        </section>

        {/* Trust strip */}
        <section aria-label="Highlights" className="border-b border-brand-navy/10 bg-white">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-6 text-sm font-medium text-brand-ink/75 sm:px-6 md:grid-cols-4">
            {["Picks up on the second ring, 24/7", "Quotes real prices on the call", "Books into a real diary", "Texts clients a confirmation"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Icon name="check" className="h-4 w-4 shrink-0 text-brand-sky" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <MeetSarah />

        {/* Who it's for */}
        <section id="who" className="scroll-mt-20 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Who it's for"
              title="Built for people who can't answer the phone mid-job"
              lead="If your hands are busy when the phone rings, Sarah picks up on the second ring. These businesses are already set up with the right questions and prices."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TRADE_PAGES.map((t) => (
                <Link
                  key={t.slug}
                  href={`/for/${t.slug}`}
                  className="group rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-ice text-brand-navy">
                    <Icon name={t.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-brand-ink">{t.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{WHO_TEXT[t.slug]}</p>
                  <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-brand-navy">
                    See how it works for {t.name.toLowerCase()}
                    <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </p>
                </Link>
              ))}
            </div>
            <p className="mt-6 text-sm text-brand-ink/70">
              Don&apos;t see your trade? Tell us what you do and we&apos;ll set it up for you.
            </p>
          </div>
        </section>

        {/* The difference */}
        <section className="bg-brand-ice py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <Eyebrow>The WorkRoute difference</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-brand-ink sm:text-4xl">
                Not a message-taking service. A receptionist who can answer &ldquo;how much?&rdquo;
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-brand-ink/70">
                Sarah uses the prices you set, plus the details she collects on the call, to give the caller a real price before
                they hang up. Then she checks your diary and books a time.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                ["Real price on the call", "Always explained as an estimate, and never a number you didn't set."],
                ["Recognises returning clients", "Brings up their record and their usual service, so regulars aren't asked everything again."],
                ["Checks real availability", "Not just an empty slot. Your diary, your hours and, for tradies, real driving time."],
                ["Texts a confirmation", "Your client gets the details, and you get a notification."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white">
                    <Icon name="check" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{t}</p>
                    <p className="mt-1 text-sm text-brand-ink/70">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <HowItWorks />

        {/* Two spotlights */}
        <section className="bg-brand-deep py-16 text-white sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              light
              eyebrow="Made for how you work"
              title="One system, two ways of working"
              lead="Whether you go to the customer or they come to you, WorkRoute fits the day."
            />
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-sky/15 text-brand-sky">
                  <Icon name="chair" className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold">Built for the chair</h3>
                <p className="mt-1 text-sm text-white/60">Hairdressers, barbers, massage and wellness</p>
                <ul className="mt-6 space-y-3">
                  {SALON_POINTS.map((p) => (
                    <li key={p} className="flex gap-3 text-[15px] leading-snug text-white/85">
                      <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-sky/15 text-brand-sky">
                  <Icon name="route" className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold">Built for the road</h3>
                <p className="mt-1 text-sm text-white/60">Lawn care, landscaping, cleaning, pool care, mechanics and other trades</p>
                <ul className="mt-6 space-y-3">
                  {TRADIE_POINTS.map((p) => (
                    <li key={p} className="flex gap-3 text-[15px] leading-snug text-white/85">
                      <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* Everything included */}
        <section id="features" className="scroll-mt-20 bg-brand-ice py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Everything included"
              title="One login. One system. One monthly price."
              lead="No separate subscriptions for a chat widget, a CRM, a booking calendar or invoicing. It's all in WorkRoute."
            />
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.name} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-ice text-brand-navy">
                    <Icon name={f.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-[15px] font-semibold leading-snug text-brand-ink">{f.name}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-brand-ink/50">Replaces {f.replaces}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <PricingSection />
        <MissedCallBand />
        <FaqSection items={BASE_FAQ} />
        <FinalCta />
      </main>

      <SiteFooter />
      <SarahChat />
    </div>
  );
}
