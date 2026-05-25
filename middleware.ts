import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { applySecurityHeaders } from "@/lib/security/headers";

const isProtectedRoute = createRouteMatcher([
  "/library(.*)",
  "/grimoire(.*)",
  "/settings(.*)",
  "/api/staves/(.*)/vote",
  "/api/staves/(.*)/save",
  "/api/staves/(.*)/comments",
  "/api/username/(.*)",
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
});

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
