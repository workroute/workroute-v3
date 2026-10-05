import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// The default Vercel-assigned domain (every project gets one, and it keeps
// working even after a custom domain is added — Vercel doesn't disable it
// automatically). Redirects here to the real domain so an old bookmark/link
// to the raw vercel.app address always lands somewhere real, not a
// second, unofficial-looking copy of the same app.
const LEGACY_HOST = "workroute-v3.vercel.app";
const CANONICAL_HOST = "app.workroute.com.au";

// The public marketing site (workroute.com.au) and the product (app.…) are one
// deploy. On the marketing domain only the marketing pages are served; any
// other path (login, the app, the API) is sent to the app address so sessions
// never end up split across two domains.
const MARKETING_HOSTS = new Set(["workroute.com.au", "www.workroute.com.au"]);
const MARKETING_EXACT = new Set([
  "/",
  "/missed-calls",
  "/contact",
  "/privacy-policy",
  "/terms-and-conditions",
  "/widget.js",
  "/sarah-avatar.png",
  "/sarah-intro.mp4",
  "/icon.png",
  "/apple-icon.png",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
]);
const MARKETING_PREFIXES = ["/for/", "/_next/", "/icons/", "/api/missed-call-report"];
// Addresses that belong to the product itself. On the marketing domain these are
// sent to the app address; any other unknown address just shows "page not found".
const APP_PREFIXES = ["/app", "/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/api", "/book", "/m/", "/slot", "/widget-frame", "/qr", "/steve.vcf"];

function isMarketingPath(rawPathname: string): boolean {
  // The old WordPress links ended in a slash ("/privacy-policy/"); treat both the same.
  const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, "") : rawPathname;
  return MARKETING_EXACT.has(pathname) || MARKETING_PREFIXES.some((p) => pathname.startsWith(p));
}

// Runs on every request. Three jobs:
// 1. Redirect the legacy vercel.app domain to the real one.
// 2. Keep the Supabase auth session fresh (refreshes expired tokens).
// 3. Bounce signed-out users away from pages that require a login.
export async function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === LEGACY_HOST) {
    const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(redirectUrl, 308); // permanent — helps search engines/browsers stop treating these as two sites
  }

  // The host the visitor actually typed (Vercel forwards it; the header also
  // works the same in local testing, where nextUrl always says "localhost").
  const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.hostname)
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");

  if (MARKETING_HOSTS.has(requestHost)) {
    if (isMarketingPath(request.nextUrl.pathname)) return NextResponse.next();
    const path = request.nextUrl.pathname;
    if (!APP_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/"))) return NextResponse.next();
    const toApp = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(toApp, 307); // temporary while the domain switch is new
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = ["/app"];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // §Website Widget — /api/widget and /widget-frame are public, cookie-less
  // routes hit from arbitrary third-party sites; running the Supabase
  // auth/cookie-refresh dance on every visitor message is pure wasted
  // latency, same reasoning as the existing _next exclusions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/widget|widget-frame).*)"],
};
