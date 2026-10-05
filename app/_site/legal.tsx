import Nav from "./nav";
import { SiteFooter } from "./sections";

// A plain page for long legal text (Privacy Policy, Terms). The wording lives in
// legal-content.ts as simple HTML (headings, paragraphs and lists only) taken
// from the old site, so it's rendered as-is.
export default function LegalPage({ html }: { html: string }) {
  return (
    <div className="bg-white text-brand-ink">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <article className="legal" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
      <SiteFooter />
    </div>
  );
}
