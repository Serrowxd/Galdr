import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { applySecurityHeaders } from "@/lib/security/headers";

// Only PAGE routes belong here: anonymous users are redirected to /sign-in.
//
// API routes are intentionally NOT listed. Each one self-guards with its own
// auth check and returns a 401 JSON. Redirecting them here instead issues a 307
// to the HTML /sign-in page that preserves the request method — the browser
// then re-POSTs to a page route with no POST handler and gets a confusing 404
// (this is exactly what broke save/vote). Let the handlers return clean 401s.
// Saga (public profile) is intentionally NOT protected: /saga/<username> is a public
// profile, and the /saga index self-redirects anon users to "/". Blocking it here
// would bounce anon visitors (who arrive via registry "top scribes" links) to
// /sign-in instead of the public profile.
const PROTECTED_ROUTES = [
  /^\/library(\/.*)?$/,
  /^\/settings(\/.*)?$/,
  // Grimoire authoring is auth-only; the public detail route /grimoires/<slug> is not.
  /^\/grimoires\/new$/,
  /^\/grimoires\/[^/]+\/edit$/,
];

function isProtected(pathname: string): boolean {
  return PROTECTED_ROUTES.some((re) => re.test(pathname));
}

export default async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  if (isProtected(request.nextUrl.pathname) && !user) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(signInUrl);
    return applySecurityHeaders(redirect);
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
