import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { applySecurityHeaders } from "@/lib/security/headers";

const PROTECTED_ROUTES = [
  /^\/library(\/.*)?$/,
  /^\/grimoire(\/.*)?$/,
  /^\/settings(\/.*)?$/,
  /^\/api\/staves\/[^/]+\/vote$/,
  /^\/api\/staves\/[^/]+\/save$/,
  // NOTE: /api/staves/[id]/comments is intentionally NOT listed — its GET is
  // public and the POST handler self-guards with its own auth check.
  /^\/api\/username\/(?!available$)/,
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
