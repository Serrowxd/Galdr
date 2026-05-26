"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

type UserAccountMenuProps = {
  user: User;
};

export function UserAccountMenu({ user }: UserAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const email = user.email ?? "";
  const emailLocal = email.split("@")[0] ?? "";
  const label =
    (user.user_metadata?.preferred_username as string | undefined) ??
    (user.user_metadata?.user_name as string | undefined) ??
    emailLocal ??
    "Scribe";

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const avatarInitial = Array.from(label.trim())[0]?.toUpperCase() ?? "?";

  async function handleSignOut() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="topbar-user-dropdown"
        id="topbar-user-trigger"
        aria-label={`Account menu, signed in as ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl ? (
          <Image
            className="user-avatar"
            src={avatarUrl}
            alt=""
            width={24}
            height={24}
            unoptimized
          />
        ) : (
          <span className="user-avatar-fallback" aria-hidden>
            {avatarInitial}
          </span>
        )}
        <span className="user-name">{label}</span>
        <ChevronDown
          size={13}
          className={`user-chevron ${open ? "is-open" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="user-dropdown"
          id="topbar-user-dropdown"
          role="menu"
          aria-labelledby="topbar-user-trigger"
        >
          <Link
            href="/grimoire"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Your grimoire
          </Link>
          <Link
            href="/library"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Your library
          </Link>
          <Link
            href="/settings"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <div className="user-menu-divider" role="presentation" />
          <button
            type="button"
            className="user-menu-item user-menu-item-signout"
            role="menuitem"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
