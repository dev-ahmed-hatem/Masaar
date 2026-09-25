"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";

import { cn } from "@/lib/cn";
import type { AdminSection } from "./sections";

/**
 * Section navigation for /admin — the one place in the product with a sidebar.
 *
 * Nine queues is too many for the top bar (which stays role-level: Home,
 * Admin), and a moderator moves between them all day, so they are always
 * visible on desktop. Below `lg` the same list becomes a horizontal rail, the
 * pattern already used by the browse filters and the profile tabs.
 */
export default function AdminNav({
  overviewHref,
  overviewLabel,
  sections,
}: {
  overviewHref: string;
  overviewLabel: string;
  sections: AdminSection[];
}) {
  const pathname = usePathname();
  const items = [
    { href: overviewHref, label: overviewLabel, icon: <LayoutGrid aria-hidden /> },
    ...sections,
  ];

  // Longest-prefix match, so /admin/teachers wins over /admin.
  const activeHref = items
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav aria-label={overviewLabel} className="lg:sticky lg:top-24">
      {/* Mobile: one scrolling rail. `no-scrollbar` keeps it from adding a
          second horizontal bar under the sticky header. */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {items.map(({ href, label, icon }) => (
          <li key={href} className="snap-start">
            <Link
              href={href}
              aria-current={href === activeHref ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-pill border px-3.5 py-2 t-small font-semibold transition-colors [&_svg]:size-4",
                href === activeHref
                  ? "border-brand bg-brand text-on-brand"
                  : "border-border-strong bg-surface text-ink-muted hover:border-brand hover:text-ink",
              )}
            >
              {icon}
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: a plain list, no chrome around it. */}
      <ul className="hidden flex-col gap-0.5 lg:flex">
        {items.map(({ href, label, icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={href === activeHref ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-control px-3 py-2 t-small font-semibold transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                href === activeHref
                  ? "bg-brand-tint text-on-brand-tint"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {icon}
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
