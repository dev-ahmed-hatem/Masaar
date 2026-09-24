import Link from "next/link";

import { Logo } from "@/components/brand/logo";

/** Marketing/site footer with a secondary link row (Find teachers, Become a
 *  teacher, Sign in). Server-rendered — no interactivity. */
export default function SiteFooter({
  locale,
  tagline,
  rights,
  links,
  craftedBy,
}: {
  locale: string;
  tagline: string;
  rights: string;
  links: { label: string; href: string }[];
  /** e.g. "Crafted by" — the Softloom studio signature. */
  craftedBy: string;
}) {
  return (
    <footer className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-8 text-center">
      <Logo locale={locale} size="md" />

      <p className="t-small max-w-md text-ink-muted">{tagline}</p>

      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 t-small font-semibold">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="link-quiet hover:text-brand">
            {l.label}
          </Link>
        ))}
      </nav>

      <p className="t-caption text-ink-faint">{rights}</p>

      {/* Studio signature. The Softloom brand guide sanctions the mono cuts for
          contexts like this; the full-colour mark is never recoloured. */}
      <a
        href="https://softloom.space"
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`${craftedBy} Softloom`}
        className="mt-2 inline-flex items-center gap-2 text-ink-faint opacity-70 transition-opacity hover:opacity-100"
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
    </footer>
  );
}
