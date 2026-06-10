import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Tenant resolution + session refresh.
 *
 * Tenant routing is path-based for the MVP (`/s/<slug>/...`) but
 * subdomain-ready: requests to `<slug>.<ROOT_DOMAIN>` are rewritten to the
 * same `/s/<slug>` routes, so enabling per-school subdomains later is purely
 * DNS + env configuration.
 */
export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  let response = NextResponse.next({ request });

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN; // e.g. "enrollly.com"
  const host = request.headers.get("host")?.split(":")[0] ?? "";

  if (
    rootDomain &&
    host.endsWith(`.${rootDomain}`) &&
    !host.startsWith("www.") &&
    !url.pathname.startsWith("/s/")
  ) {
    const slug = host.slice(0, -(rootDomain.length + 1));
    const rewritten = url.clone();
    rewritten.pathname = `/s/${slug}${url.pathname}`;
    response = NextResponse.rewrite(rewritten, { request });
  }

  const { response: finalResponse, user } = await updateSession(request, response);

  // Gate authenticated areas. Public: school landing pages, marketing, auth.
  const path = url.pathname;
  const needsAuth =
    /^\/s\/[^/]+\/(admin|portal)/.test(path) || path === "/onboarding" || path === "/schools";

  if (needsAuth && !user) {
    const login = url.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }

  return finalResponse;
}

export const config = {
  matcher: [
    // Skip static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
