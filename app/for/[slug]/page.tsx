import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRADE_QUESTIONS } from "@/lib/trade-questions";
import Nav from "../../_site/nav";
import Demo from "../../_site/demo";
import { COMMON_FAQ, FaqSection, FinalCta, HowItWorks, PricingSection, SarahChat, SiteFooter } from "../../_site/sections";
import { TRADE_PAGES, findTradePage } from "../../_site/trades";
import { GUIDES } from "../../_site/guides";
import { JsonLd, breadcrumbs, faqPage } from "../../_site/jsonld";
import { DEMO_PHONE_DISPLAY, DEMO_PHONE_TEL, Eyebrow, Icon, SIGNUP_HREF, SectionHeading } from "../../_site/ui";

// One page per trade (/for/pool-care, /for/mechanics, ...), all driven by
// app/_site/trades.ts. Only these slugs exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return TRADE_PAGES.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = findTradePage(params.slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/for/${page.slug}` },
    openGraph: { title: page.title, description: page.description, type: "website" },
  };
}

export default function TradePage({ params }: { params: { slug: string } }) {
  const page = findTradePage(params.slug);
  if (!page) notFound();

  // The questions Sarah can price, straight from the product's own question
  // set. Free-text questions aren't priced, so they're left out.
  const priced = (TRADE_QUESTIONS[page.tradeKey] ?? []).filter(
    (q) => q.type === "select" || q.type === "multiselect" || q.type === "boolean"
  );
  const alsoPriced = page.also
    ? (TRADE_QUESTIONS[page.also.tradeKey] ?? []).filter((q) => q.type === "select" || q.type === "multiselect" || q.type === "boolean")
    : [];
  const others = TRADE_PAGES.filter((t) => t.slug !== page.slug);
  const roadOrChair = page.kind === "chair" ? "Built for the chair" : "Built for the road";

  const guides = (page.guides ?? []).map((s) => GUIDES.find((g) => g.slug === s)).filter((g): g is NonNullable<typeof g> => !!g);

  return (
    <div className="bg-white text-brand-ink">
      <JsonLd
        data={[
          faqPage([...page.faq, ...COMMON_FAQ]),
          breadcrumbs([{ name: "Home", path: "/" }, { name: page.name, path: `/for/${page.slug}` }]),
        ]}
      />
      <Nav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-navy to-brand-deep text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "28px 28px" }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-brand-sky/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr,0.95fr] lg:py-24">
            <div>
              <Link href="/#who" className="inline-flex items-center gap-2 text-sm text-white/65 transition hover:text-white">
                <Icon name={page.icon} className="h-4 w-4 text-brand-sky" />
                {page.name}
              </Link>
              <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                {page.h1a}
                <br />
                <span className="text-brand-sky">{page.h1b}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">{page.lead}</p>
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
            <Demo scenarios={[page.scenario]} />
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow={page.name} title="What changes when Sarah answers" />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {page.benefits.map((b) => (
                <div key={b.title} className="rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-ice text-brand-navy">
                    <Icon name={b.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-brand-ink">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What Sarah can price */}
        <section className="bg-brand-ice py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Real prices"
              title={`What Sarah can price for ${page.name.toLowerCase()}`}
              lead="These questions are built in for your trade. You set a price for the answers that matter, and Sarah only asks about what changes your price."
            />
            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {priced.map((q) => (
                <div key={q.id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="font-display text-[15px] font-semibold text-brand-ink">{q.label.replace(/^If a fault — /, "")}</p>
                  {q.aiClassifiedFrom && (
                    <p className="mt-0.5 text-xs font-medium text-brand-navy/70">Sarah works this out herself, so she doesn&apos;t quiz the caller</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {q.type === "boolean" ? (
                      ["Yes", "No"].map((o) => (
                        <span key={o} className="rounded-full bg-brand-ice px-2.5 py-1 text-xs text-brand-ink/80">{o}</span>
                      ))
                    ) : q.type === "select" || q.type === "multiselect" ? (
                      q.options.slice(0, 8).map((o) => (
                        <span key={o.value} className="rounded-full bg-brand-ice px-2.5 py-1 text-xs text-brand-ink/80">{o.label}</span>
                      ))
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {page.also && alsoPriced.length > 0 && (
              <>
                <h3 className="mt-12 font-display text-2xl font-bold text-brand-ink">{page.also.label}</h3>
                <p className="mt-2 max-w-2xl text-brand-ink/70">
                  Projects are quoted one at a time. Mark these as &ldquo;requires quote&rdquo; and Sarah books a site visit, then
                  tells the caller you&apos;ll confirm the price in person.
                </p>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {alsoPriced.map((q) => (
                    <div key={q.id} className="rounded-2xl bg-white p-5 shadow-sm">
                      <p className="font-display text-[15px] font-semibold text-brand-ink">{q.label}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {q.type === "select" || q.type === "multiselect"
                          ? q.options.slice(0, 8).map((o) => (
                              <span key={o.value} className="rounded-full bg-brand-ice px-2.5 py-1 text-xs text-brand-ink/80">{o.label}</span>
                            ))
                          : ["Yes", "No"].map((o) => (
                              <span key={o} className="rounded-full bg-brand-ice px-2.5 py-1 text-xs text-brand-ink/80">{o}</span>
                            ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Built for */}
        <section className="bg-brand-deep py-16 text-white sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <SectionHeading light eyebrow={roadOrChair} title={`Made for ${page.name.toLowerCase()}`} />
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {page.features.map((f) => (
                <li key={f} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-[15px] leading-snug text-white/90">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <HowItWorks />
        <PricingSection />
        <FaqSection items={[...page.faq, ...COMMON_FAQ]} />

        {guides.length > 0 && (
          <section className="bg-white py-14">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <Eyebrow>Guides</Eyebrow>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {guides.map((g) => (
                  <Link
                    key={g.slug}
                    href={`/guides/${g.slug}`}
                    className="rounded-2xl border border-brand-navy/10 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <p className="font-display text-lg font-semibold leading-snug text-brand-ink">{g.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{g.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Other trades */}
        <section className="bg-brand-ice py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Eyebrow>Also built for</Eyebrow>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {others.map((t) => (
                <Link
                  key={t.slug}
                  href={`/for/${t.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-navy/15 bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:border-brand-navy hover:bg-brand-navy hover:text-white"
                >
                  <Icon name={t.icon} className="h-4 w-4" />
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <FinalCta />
      </main>

      <SiteFooter />
      <SarahChat />
    </div>
  );
}
