import Link from "next/link";

import { Logo } from "@/components/brand/logo";

interface FooterLink {
  label: string;
  href: string;
}

/**
 * Global site footer. Rendered from the (app) layout, so it appears on every
 * page rather than only the landing page as it used to.
 *
 * Server-rendered — no interactivity.
 */
export default function SiteFooter({
  locale,
  tagline,
  rights,
  craftedBy,
  columns,
}: {
  locale: string;
  tagline: string;
  rights: string;
  /** e.g. "Crafted by" — the Softloom studio signature. */
  craftedBy: string;
  columns: { title: string; links: FooterLink[] }[];
}) {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <Logo locale={locale} size="md" />
            <p className="mt-4 t-small text-ink-muted">{tagline}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-16">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="t-overline text-ink-faint">{col.title}</h2>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="t-small link-quiet hover:text-brand">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="t-caption text-ink-faint">{rights}</p>

          {/* Studio signature. The Softloom brand guide sanctions the mono cuts
              for contexts like this; the full-colour mark is never recoloured. */}
          <a
            href="https://softloom.space"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${craftedBy} Softloom`}
            className="inline-flex items-center gap-2 text-ink-faint opacity-75 transition-opacity hover:opacity-100"
          >
            <span className="t-caption">{craftedBy}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/softloom/wordmark-mono-ink.svg"
              alt="Softloom"
              width={92}
              height={15}
              className="h-[15px] w-auto dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/softloom/wordmark-mono-white.svg"
              alt="Softloom"
              width={92}
              height={15}
              className="hidden h-[15px] w-auto dark:block"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
