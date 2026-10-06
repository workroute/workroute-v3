import type { Metadata } from "next";
import Link from "next/link";
import Nav from "../_site/nav";
import { FinalCta, SiteFooter } from "../_site/sections";
import { GUIDES } from "../_site/guides";
import { JsonLd, breadcrumbs } from "../_site/jsonld";
import { Eyebrow, Icon } from "../_site/ui";

export const metadata: Metadata = {
  title: "Guides for salon owners and small businesses | WorkRoute",
  description: "Plain-English guides on missed calls, AI receptionists and filling cancellations, written for hair salons and small service businesses.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <div className="bg-white text-brand-ink">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }])} />
      <Nav />
      <main>
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
          <Eyebrow>Guides</Eyebrow>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-brand-ink sm:text-5xl">
            Straight talk for busy salon owners
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-brand-ink/70">
            Short, honest guides on missed calls, AI receptionists and filling the gaps in your diary.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {GUIDES.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="group rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="font-mono text-xs uppercase tracking-widest text-brand-navy/60">{g.readMinutes} min read</p>
                <h2 className="mt-2 font-display text-xl font-semibold leading-snug text-brand-ink">{g.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{g.description}</p>
                <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-brand-navy">
                  Read the guide
                  <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </section>
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
