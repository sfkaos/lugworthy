"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Main navigation; marks the section you're in. */
export function NavLinks({ links }: { links: readonly (readonly [string, string])[] }) {
  const pathname = usePathname();
  return (
    <>
      {links.map(([href, label]) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className="nav-link" aria-current={current ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </>
  );
}
