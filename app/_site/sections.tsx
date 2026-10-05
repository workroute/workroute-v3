import Link from "next/link";
import Script from "next/script";
import { WORKROUTE_SALES_WIDGET_KEY } from "@/lib/workroute-sales-ai";
import { DEMO_PHONE_DISPLAY, DEMO_PHONE_TEL, Icon, LOGIN_HREF, Logo, SIGNUP_HREF, SectionHeading } from "./ui";

// Sections shared by the homepage and every /for/<trade> page, so they can't
// drift apart.

const STEPS = [
  { n: "1", title: "Tell Sarah about your business", text: "Add your services, prices and working hours in a simple form. It takes about three minutes and needs no technical skills." },
  { n: "2", title: "We connect your number", text: "Your business gets its own phone number, and Sarah answers it 24/7 with an Australian voice." },
  { n: "3", title: "Bookings land in your diary", text: "You get a notification, and your client gets a confirmation text. You just turn up and do the work." },
] as const;

// The intro video of Sarah (public/sarah-intro.mp4, 16 seconds, with sound).
// It used to be embedded inside the old WordPress page.
export function MeetSarah() {
  return (
    <section id="meet" className="scroll-mt-20 bg-brand-ice py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="overflow-hidden rounded-3xl bg-brand-deep shadow-xl shadow-brand-navy/15 ring-1 ring-brand-navy/10">
          <video
            className="aspect-video w-full bg-brand-deep"
            controls
            playsInline
            preload="metadata"
            aria-label="Sarah, WorkRoute AI Office Manager"
          >
            <source src="/sarah-intro.mp4" type="video/mp4" />
          </video>
        </div>
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-brand-navy/70">Meet Sarah</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-brand-ink sm:text-4xl">
            Press play and meet who answers your phone
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-brand-ink/70">
            Sarah is the AI office manager behind WorkRoute. She answers 24/7 with an Australian voice, so the first voice your
            customers hear sounds like part of your business.
          </p>
          <ul className="mt-6 space-y-3">
            {["No sick days. No holidays.", "Recognises returning clients", "Quotes real prices and books real times"].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[15px] font-medium text-brand-ink/85">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="How it works" title="Up and running in three steps" center />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="relative rounded-2xl border border-brand-navy/10 p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-navy font-display text-lg font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold text-brand-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Pricing" title="Simple, with a free trial first" center />
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="flex flex-col rounded-3xl border-2 border-brand-sky bg-white p-8 shadow-lg shadow-brand-sky/10">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-brand-navy/70">Tradies</p>
            <p className="mt-3 font-display text-5xl font-bold text-brand-ink">
              $199<span className="text-lg font-medium text-brand-ink/60"> / month</span>
            </p>
            <p className="mt-2 text-sm text-brand-ink/70">Everything included, on one simple monthly subscription.</p>
            <ul className="mt-6 space-y-2.5 text-sm text-brand-ink/80">
              {["Sarah answering calls, chat and texts", "Real prices and booking", "Route planning, invoices and review requests", "Every feature listed above"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href={SIGNUP_HREF}
              className="mt-8 inline-flex items-center justify-center rounded-full bg-brand-navy px-6 py-3.5 font-display font-semibold text-white transition hover:bg-brand-deep"
            >
              Start your free trial
            </Link>
          </div>

          <div className="flex flex-col rounded-3xl border border-brand-navy/15 bg-brand-ice/60 p-8">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-brand-navy/70">Salons and appointment businesses</p>
            <p className="mt-3 font-display text-3xl font-bold leading-tight text-brand-ink">Start the same free trial</p>
            <p className="mt-2 text-sm text-brand-ink/70">
              Hairdressers, barbers, massage and similar. We&apos;ll confirm your plan with you before you pay anything.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-brand-ink/80">
              {["Sarah answering while you work", "A price and a time for each service", "Several chairs, preferred stylist and cancellation filling"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href={SIGNUP_HREF}
              className="mt-auto inline-flex items-center justify-center rounded-full border border-brand-navy/25 bg-white px-6 py-3.5 font-display font-semibold text-brand-navy transition hover:bg-brand-navy hover:text-white"
            >
              Start your free trial
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-brand-ink/60">The free trial runs for 14 days or 150 calls, whichever comes first.</p>
      </div>
    </section>
  );
}

export function MissedCallBand() {
  return (
    <section className="bg-brand-navy py-14 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">What are missed calls costing you?</h2>
          <p className="mt-2 text-white/75">Put in your own numbers and see roughly what goes to the next business on Google. It takes a minute and it&apos;s free.</p>
        </div>
        <Link
          href="/missed-calls"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-7 py-3.5 font-display font-semibold text-brand-navy transition hover:bg-brand-sky"
        >
          Try the calculator
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export type FaqItem = { q: string; a: string };

export const BASE_FAQ: FaqItem[] = [
  { q: "Is Sarah a real person?", a: "No, Sarah is an AI, and she says so if anyone asks. She works 24/7 with an Australian voice, and she never makes up a price or a promise." },
  { q: "Can she really quote a price?", a: "Yes, using the prices you enter during setup. She always explains that it's an estimate, and she only ever states a number that comes from your own price list." },
  { q: "What if Sarah can't handle something?", a: "She flags it for you as low, medium or high priority, and you get a notification for anything urgent. A complaint or a request to speak to a person always comes to you." },
  { q: "Does it work with Fresha, Timely or Square?", a: "Not yet. WorkRoute has its own diary, and Sarah books straight into it. Tell us what you use and we'll take it on board." },
  { q: "Does each stylist get their own calendar?", a: "Not yet. A salon says how many people can work at once, and clients can ask for a preferred stylist. Separate calendars for each person are something we're looking at." },
  { q: "Do I need to be technical?", a: "No. Setup is a simple form: your services, your prices and your working hours." },
  { q: "Can I take my customers with me if I leave?", a: "Yes. You can download your full customer list at any time. There's no lock-in." },
  { q: "My trade isn't listed. Can it still work?", a: "Probably. Tell Steve what you do and he'll set it up for you." },
];

// The shared answers a trade page keeps (the salon-only ones are dropped on
// road trades, and the diary-software one is dropped where the page already
// answers it).
export const COMMON_FAQ: FaqItem[] = BASE_FAQ.filter((f) =>
  ["Is Sarah a real person?", "Can she really quote a price?", "What if Sarah can't handle something?", "Do I need to be technical?", "Can I take my customers with me if I leave?", "My trade isn't listed. Can it still work?"].includes(f.q)
);

export function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="Questions" title="Straight answers" center />
        <div className="mt-10 divide-y divide-brand-navy/10 rounded-2xl border border-brand-navy/10">
          {items.map((f) => (
            <details key={f.q} className="group px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-semibold text-brand-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon name="chevron" className="h-5 w-5 shrink-0 text-brand-navy/60 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-brand-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-navy to-brand-deep py-16 text-center text-white sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-sky/20 blur-3xl" />
      <div className="relative mx-auto max-w-2xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl">Ready for every call to be answered?</h2>
        <p className="mt-4 text-lg text-white/75">Try Sarah free for 14 days, or ring her now and hear how she sounds.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={SIGNUP_HREF}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-sky px-8 py-4 font-display text-base font-semibold text-brand-deep transition hover:bg-white"
          >
            Start your free trial
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
          <a
            href={`tel:${DEMO_PHONE_TEL}`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 font-display text-base font-semibold text-white transition hover:border-white hover:bg-white/10"
          >
            <Icon name="phone" className="h-4 w-4" />
            {DEMO_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-brand-deep text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-sm">An AI receptionist and diary for tradies and local services.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 text-sm sm:grid-cols-3">
          <Link href={SIGNUP_HREF} className="block py-2 hover:text-white">Start free trial</Link>
          <Link href={LOGIN_HREF} className="block py-2 hover:text-white">Log in</Link>
          <Link href="/missed-calls" className="block py-2 hover:text-white">Missed-call calculator</Link>
          <Link href="/#who" className="block py-2 hover:text-white">Who it&apos;s for</Link>
          <Link href="/#pricing" className="block py-2 hover:text-white">Pricing</Link>
          <Link href="/#faq" className="block py-2 hover:text-white">FAQ</Link>
          <a href={`tel:${DEMO_PHONE_TEL}`} className="block py-2 hover:text-white">Ring Sarah: {DEMO_PHONE_DISPLAY}</a>
          <a href="mailto:steve@workroute.com.au" className="block py-2 hover:text-white">steve@workroute.com.au</a>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/45">© {new Date().getFullYear()} WorkRoute. Made in Australia.</div>
    </footer>
  );
}

// Sarah's website chat (the same widget tradies can put on their own sites).
export function SarahChat() {
  return <Script src="/widget.js" data-widget-key={WORKROUTE_SALES_WIDGET_KEY} strategy="afterInteractive" />;
}
