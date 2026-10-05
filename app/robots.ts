import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// Search engines should list workroute.com.au only. The app address
// (app.workroute.com.au) serves the same marketing pages plus the signed-in
// product, so it asks crawlers to stay out and avoid duplicate listings.
export default function robots(): MetadataRoute.Robots {
  const host = (headers().get("x-forwarded-host") ?? headers().get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  const isMarketingSite = host === "workroute.com.au" || host === "www.workroute.com.au";

  if (!isMarketingSite) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://workroute.com.au/sitemap.xml",
  };
}
