import Link from "next/link";
import { GraduationCap } from "lucide-react";

/** Marketing/site footer with a secondary link row (Find teachers, Become a
 *  teacher, Sign in). Server-rendered — no interactivity. */
export default function SiteFooter({
  brand,
  tagline,
  rights,
  links,
}: {
  brand: string;
  tagline: string;
  rights: string;
  links: { label: string; href: string }[];
}) {
  return (
    <footer
      className="mt-8 flex flex-col items-center gap-4 pt-8 text-center"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center gap-2.5 text-lg font-bold"
        style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white"
          style={{ background: "var(--grad-brand)" }}
        >
          <GraduationCap size={18} strokeWidth={2.4} />
        </span>
        {brand}
      </div>
      <p className="max-w-md text-sm" style={{ color: "var(--ink-muted)" }}>
        {tagline}
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="link-brand" style={{ color: "var(--ink-muted)" }}>
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
        {rights}
      </p>
    </footer>
  );
}
