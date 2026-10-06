// Structured data (schema.org JSON-LD) so Google can understand the site: who
// WorkRoute is, what it sells, and which questions a page answers. Only facts
// already visible on the page go in here (no invented ratings or reviews).
export const SITE_URL = "https://workroute.com.au";

export function JsonLd({ data }: { data: object | object[] }) {
  // "<" is escaped so no text can ever close the script tag early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "WorkRoute",
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  email: "steve@workroute.com.au",
  areaServed: "AU",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: "steve@workroute.com.au",
    telephone: "+61735226422",
    areaServed: "AU",
    availableLanguage: "English",
  },
};

export const WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "WorkRoute",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

export const SOFTWARE = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "WorkRoute",
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, installable on iPhone and Android",
  description:
    "An AI receptionist and diary for tradies and local services. Sarah answers every call, quotes a real price from your own price list and books a real time in your diary.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  offers: {
    "@type": "Offer",
    name: "WorkRoute for tradies",
    price: "199",
    priceCurrency: "AUD",
    description: "Per month, everything included. 14-day or 150-call free trial.",
  },
};

export function faqPage(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

export function breadcrumbs(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: `${SITE_URL}${t.path}`,
    })),
  };
}

export function article(opts: { title: string; description: string; path: string; published: string; modified?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    mainEntityOfPage: `${SITE_URL}${opts.path}`,
    datePublished: opts.published,
    dateModified: opts.modified ?? opts.published,
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}
