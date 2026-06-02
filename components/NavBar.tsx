"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GaldrSignInButton } from "@/components/GaldrSignInButton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserAccountMenu } from "@/components/UserAccountMenu";
import { VegvisirLogo } from "@/components/VegvisirLogo";
import type { User } from "@supabase/supabase-js";

const navLinks = [
  { href: "/about", label: "About" },
  { href: "/registry", label: "Registry" },
  { href: "/loom", label: "Loom" },
  { href: "/library", label: "Library" },
  { href: "/tavern", label: "Tavern" },
  { href: "/saga", label: "Saga" },
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
        const isActive = pathname.startsWith(item.href);
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
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  const isLoaded = user !== undefined;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <Link href="/" className="brand" aria-label="Galdr home">
            <VegvisirLogo size={28} className="brand-mark" />
            <span className="brand-name">Galdr</span>
          </Link>

          <nav aria-label="Primary navigation" className="topnav">
            <PrimaryNavLinks pathname={pathname} />
          </nav>
        </div>

        <div className="topbar-right">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="topbar-menu-trigger"
                aria-expanded={mobileNavOpen}
                aria-controls="primary-nav-sheet"
              >
                <Menu size={18} strokeWidth={1.75} aria-hidden />
                <span className="sr-only">Open navigation menu</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              id="primary-nav-sheet"
              showCloseButton
            >
              <SheetHeader>
                <SheetTitle className="sr-only">Primary navigation</SheetTitle>
              </SheetHeader>
              <nav
                className="topnav"
                style={{ flexDirection: "column", alignItems: "stretch", gap: 4, padding: "8px 0" }}
                aria-label="Primary navigation"
              >
                <PrimaryNavLinks
                  pathname={pathname}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </nav>
            </SheetContent>
          </Sheet>

          {!isLoaded ? (
            <span className="user-skel" aria-hidden />
          ) : user ? (
            <UserAccountMenu user={user} />
          ) : (
            <GaldrSignInButton>
              <button type="button" className="btn btn-ghost btn-sm">
                Sign in
              </button>
            </GaldrSignInButton>
          )}
        </div>
      </div>
    </header>
  );
}
