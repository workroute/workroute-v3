import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// The default Vercel-assigned domain (every project gets one, and it keeps
// working even after a custom domain is added — Vercel doesn't disable it
// automatically). Redirects here to the real domain so an old bookmark/link
// to the raw vercel.app address always lands somewhere real, not a
// second, unofficial-looking copy of the same app.
const LEGACY_HOST = "workroute-v3.vercel.app";
const CANONICAL_HOST = "app.workroute.com.au";

// Runs on every request. Three jobs:
// 1. Redirect the legacy vercel.app domain to the real one.
// 2. Keep the Supabase auth session fresh (refreshes expired tokens).
// 3. Bounce signed-out users away from pages that require a login.
export async function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === LEGACY_HOST) {
    const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(redirectUrl, 308); // permanent — helps search engines/browsers stop treating these as two sites
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
