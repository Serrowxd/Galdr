import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { applySecurityHeaders } from "@/lib/security/headers";

export default clerkMiddleware((_auth, request: NextRequest) => {
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
