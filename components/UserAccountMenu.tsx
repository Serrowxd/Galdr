"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function UserAccountMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onPointer = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (!isLoaded) {
    return <span className="topbar-user-menu-skel" aria-hidden />;
  }

  if (!user) return null;

  const emailFull = user.primaryEmailAddress?.emailAddress ?? "";
  const at = emailFull.indexOf("@");
  const emailLocal = at > 0 ? emailFull.slice(0, at) : "";

  const hasUsername =
    typeof user.username === "string" && user.username.trim().length > 0;

  const label = hasUsername
    ? user.username!.trim()
    : emailLocal || user.firstName?.trim() || "Scribe";

  const avatarUrl = user.imageUrl;

  const avatarInitial = Array.from(label.trim())[0];

  return (
    <div className="topbar-user-menu" ref={rootRef}>
      <button
        type="button"
        className="topbar-user-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="topbar-user-dropdown"
        id="topbar-user-trigger"
        aria-label={`Account menu, signed in as ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl ? (
          <Image
            className="topbar-user-avatar"
            src={avatarUrl}
            alt=""
            width={26}
            height={26}
            unoptimized
          />
        ) : (
          <span className="topbar-user-avatar-placeholder" aria-hidden>
            {avatarInitial ? avatarInitial.toUpperCase() : "?"}
          </span>
        )}
        <span className="topbar-user-name">{label}</span>
        <ChevronDown
          size={14}
          className={`topbar-user-chevron ${open ? "is-open" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="topbar-user-dropdown"
          id="topbar-user-dropdown"
          role="menu"
          aria-labelledby="topbar-user-trigger"
        >
          <button type="button" className="topbar-user-menu-item" role="menuitem">
            Profile <span className="topbar-user-placeholder-tag">soon</span>
          </button>
          <button type="button" className="topbar-user-menu-item" role="menuitem">
            Invocations ledger <span className="topbar-user-placeholder-tag">soon</span>
          </button>
          <button type="button" className="topbar-user-menu-item" role="menuitem">
            API keys <span className="topbar-user-placeholder-tag">soon</span>
          </button>
          <div className="topbar-user-menu-divider" role="presentation" />
          <button
            type="button"
            className="topbar-user-menu-item topbar-user-menu-item-signout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ redirectUrl: "/" });
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
