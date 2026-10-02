"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/history", label: "History" },
  { href: "/progress", label: "Progress" },
  { href: "/profile", label: "Profile" },
];

export default function NavLinks({
  className = "",
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-btn px-3 text-sm font-semibold transition-colors ${
              active ? "bg-accent text-ground" : "text-muted hover:text-ink"
            } ${className}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
