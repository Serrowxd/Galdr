"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type GaldrSignInButtonProps = {
  children: ReactNode;
};

/** Wraps children in a link to /sign-in, passing the current path as ?next= */
export function GaldrSignInButton({ children }: GaldrSignInButtonProps) {
  const pathname = usePathname();
  const href = `/sign-in?next=${encodeURIComponent(pathname || "/")}`;

  return <Link href={href}>{children}</Link>;
}
