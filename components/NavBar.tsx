"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserAccountMenu } from "@/components/UserAccountMenu";
import { VegvisirLogo } from "@/components/VegvisirLogo";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/registry", label: "Registry" },
  { href: "/library", label: "Library" },
  { href: "/loom", label: "The Loom" },
  { href: "/settings", label: "Settings" },
  { href: "/grimoire", label: "Grimoire" },
];

function PrimaryNavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {navLinks.map((item) => {
        const isActive =
          item.href === "/grimoire"
            ? pathname.startsWith("/grimoire")
            : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`topnav-link ${isActive ? "is-active" : ""}`}
            onClick={() => onNavigate?.()}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-inner frame">
        <div className="brand" aria-label="Galdr brand">
          <VegvisirLogo size={36} />
          <span className="brand-title">GALDR</span>
        </div>

        <nav aria-label="Primary navigation" className="topnav topnav--desktop">
          <PrimaryNavLinks pathname={pathname} />
        </nav>

        <div className="topnav-mobile">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="btn-ghost-sm topnav-menu-trigger"
                aria-expanded={mobileNavOpen}
                aria-controls="primary-nav-sheet"
              >
                <Menu size={20} strokeWidth={2} aria-hidden />
                <span className="sr-only">Open navigation menu</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              id="primary-nav-sheet"
              className="sheet-content-brutalist"
              showCloseButton
            >
              <SheetHeader>
                <SheetTitle className="sr-only">Primary navigation</SheetTitle>
              </SheetHeader>
              <nav className="topnav-sheet-nav" aria-label="Primary navigation">
                <PrimaryNavLinks
                  pathname={pathname}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        <div className="topbar-auth">
          {!isLoaded ? (
            <span className="topbar-auth-skel" aria-hidden />
          ) : isSignedIn ? (
            <UserAccountMenu />
          ) : (
            <SignInButton mode="modal">
              <button type="button" className="btn-ghost-sm">
                Sign in
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  );
}
