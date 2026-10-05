import type { MetadataRoute } from "next";
import { TRADE_PAGES } from "./_site/trades";

// The public marketing pages, listed for Google. Only workroute.com.au is the
// "real" address; the app itself (login, dashboard) is deliberately left out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://workroute.com.au";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...TRADE_PAGES.map((t) => ({ url: `${base}/for/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${base}/missed-calls`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
