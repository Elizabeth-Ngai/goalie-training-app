"use client";

import { useState } from "react";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import NavLinks from "@/components/ui/NavLinks";
import { ButtonLink } from "@/components/ui/Button";

const marketingLinkClass =
  "flex min-h-11 items-center px-3 text-sm font-semibold text-muted transition-colors hover:text-ink";

const userButtonAppearance = {
  elements: {
    userButtonAvatarBox: "h-11 w-11",
    userButtonPopoverActionButton__manageAccount: "text-white",
    userButtonPopoverActionButton__signOut: "text-white",
  },
};

export default function HeaderNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      <nav className="hidden items-center gap-1 md:flex">
        <Show when="signed-in">
          <NavLinks />
        </Show>
        <Show when="signed-out">
          <Link href="/#how-it-works" className={marketingLinkClass}>
            How It Works
          </Link>
          <Link href="/#features" className={marketingLinkClass}>
            Features
          </Link>
        </Show>
      </nav>

      <div className="hidden items-center gap-3 md:flex">
        <Show when="signed-in">
          <ButtonLink href="/analyze" variant="secondary">
            Upload clip
          </ButtonLink>
          <UserButton appearance={userButtonAppearance} />
        </Show>
        <Show when="signed-out">
          <Link href="/sign-in" className={marketingLinkClass}>
            Sign In
          </Link>
          <ButtonLink href="/sign-up" variant="primary">
            Get Started
          </ButtonLink>
        </Show>
      </div>

      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-btn border border-line-strong text-ink md:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
          {open ? (
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-20 mt-2 w-64 rounded-card border border-line bg-surface p-3 shadow-lg md:hidden">
          <div className="flex flex-col gap-1">
            <Show when="signed-in">
              <NavLinks className="w-full" onNavigate={() => setOpen(false)} />
              <Link
                href="/analyze"
                onClick={() => setOpen(false)}
                className="mt-2 flex min-h-11 items-center justify-center rounded-btn border border-line-strong bg-surface-2 px-4 text-sm font-semibold text-ink"
              >
                Upload clip
              </Link>
              <div className="mt-2 flex items-center justify-between border-t border-line px-1 pt-3">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Account</span>
                <UserButton appearance={userButtonAppearance} />
              </div>
            </Show>
            <Show when="signed-out">
              <Link
                href="/#how-it-works"
                onClick={() => setOpen(false)}
                className={`${marketingLinkClass} w-full`}
              >
                How It Works
              </Link>
              <Link
                href="/#features"
                onClick={() => setOpen(false)}
                className={`${marketingLinkClass} w-full`}
              >
                Features
              </Link>
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className={`${marketingLinkClass} w-full`}
              >
                Sign In
              </Link>
              <ButtonLink href="/sign-up" variant="primary" className="mt-2 w-full">
                Get Started
              </ButtonLink>
            </Show>
          </div>
        </div>
      )}
    </div>
  );
}
