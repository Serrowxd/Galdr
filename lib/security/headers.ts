import type { NextResponse } from "next/server";

/**
 * Next.js + React rely on eval() in development (e.g. Turbopack, stack reconstruction).
 * Keep production strict without 'unsafe-eval'.
 */
function buildContentSecurityPolicy(): string {
  const scriptDev =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https://img.clerk.com https://*.clerk.com",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${scriptDev} https://*.clerk.com https://*.clerk.accounts.dev`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev",
    "frame-src https://*.clerk.com https://*.clerk.accounts.dev",
    "worker-src 'self' blob:",
  ].join("; ");
}

export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(),
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return response;
}
