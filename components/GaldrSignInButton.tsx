"use client";

import { SignInButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type GaldrSignInButtonProps = {
  children: ReactNode;
};

/**
 * Opens Clerk sign-in in a modal on the current page.
 * OAuth runs in a popup so the Galdr page never navigates to /sign-in.
 */
export function GaldrSignInButton({ children }: GaldrSignInButtonProps) {
  const pathname = usePathname();
  const fallbackRedirectUrl = pathname || "/";

  return (
    <SignInButton
      mode="modal"
      oauthFlow="popup"
      fallbackRedirectUrl={fallbackRedirectUrl}
      signUpFallbackRedirectUrl={fallbackRedirectUrl}
    >
      {children}
    </SignInButton>
  );
}
