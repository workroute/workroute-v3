import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "../../_site/nav";
import { FaqSection, FinalCta, SiteFooter } from "../../_site/sections";
import { GUIDES, findGuide, type Block } from "../../_site/guides";
import { JsonLd, article, breadcrumbs, faqPage } from "../../_site/jsonld";
import { Eyebrow, Icon, SIGNUP_HREF } from "../../_site/ui";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = findGuide(params.slug);
  if (!guide) return {};
  return {
    title: `${guide.title} | WorkRoute`,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, type: "article" },
  };
}

function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case "h2":
      return (
        <h2 key={i} className="mt-10 font-display text-2xl font-bold leading-snug text-brand-ink">
          {block.text}
        </h2>
      );
    case "p":
      return (
        <p key={i} className="mt-4 text-[17px] leading-relaxed text-brand-ink/80">
          {block.text}
        </p>
      );
    case "ul":
      return (
        <ul key={i} className="mt-4 list-disc space-y-2 pl-6 text-[17px] leading-relaxed text-brand-ink/80">
          {block.items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={i} className="mt-4 list-decimal space-y-2 pl-6 text-[17px] leading-relaxed text-brand-ink/80">
          {block.items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      );
    case "note":
      return (
        <aside key={i} className="mt-6 rounded-2xl border border-brand-sky/40 bg-brand-ice p-5">
          <p className="font-display font-semibold text-brand-navy">{block.title}</p>
          <p className="mt-1 text-[15.5px] leading-relaxed text-brand-ink/80">{block.text}</p>
        </aside>
      );
  }
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = findGuide(params.slug);
  if (!guide) notFound();

  const related = guide.related.map((s) => findGuide(s)).filter((g): g is NonNullable<typeof g> => !!g);
  const path = `/guides/${guide.slug}`;

  return (
    <div className="bg-white text-brand-ink">
      <JsonLd
        data={[
          article({ title: guide.title, description: guide.description, path, published: guide.published }),
          faqPage(guide.faq),
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
            { name: guide.title, path },
          ]),
        ]}
      />
      <Nav />
      <main>
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <Link href="/guides" className="text-sm font-medium text-brand-navy/70 hover:text-brand-navy">
            ← All guides
          </Link>
          <div className="mt-4">
            <Eyebrow>Guide · {guide.readMinutes} min read</Eyebrow>
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-brand-ink sm:text-5xl">{guide.h1}</h1>
          {guide.blocks.map(renderBlock)}

          <div className="mt-12 rounded-3xl bg-brand-navy p-7 text-white sm:p-9">
            <p className="font-display text-2xl font-bold">See what it could be costing you</p>
            <p className="mt-2 text-white/75">Put in your own numbers in a minute, or try Sarah free for 14 days.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/missed-calls"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-display font-semibold text-brand-navy transition hover:bg-brand-sky"
              >
                Try the calculator
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <a
                href={SIGNUP_HREF}
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 font-display font-semibold text-white transition hover:bg-white/10"
              >
                Start your free trial
              </a>
            </div>
          </div>

          {related.length > 0 && (
            <div className="mt-12">
              <p className="font-display text-lg font-semibold text-brand-ink">Keep reading</p>
              <ul className="mt-3 space-y-2">
                {related.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/guides/${g.slug}`} className="font-medium text-brand-navy underline">
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <FaqSection items={guide.faq} />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
