"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Daily Memo" },
  { href: "/bookings", label: "Bookings" },
  { href: "/departments", label: "Departments" },
  { href: "/staff", label: "Staff" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={`nav-link whitespace-nowrap ${active ? "nav-link-active" : ""}`}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
