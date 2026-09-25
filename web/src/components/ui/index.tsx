import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The /admin layout helpers. Everything front-of-house uses the primitives in
 * this folder directly; these four only exist because the moderator views are
 * ten variations on "heading, filter toolbar, table, detail drawer".
 */

/** Consistent page heading: optional eyebrow, strong title, muted subtitle, actions. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  extra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <span className="mb-2 inline-block rounded-pill bg-brand-tint px-3 py-1 t-caption font-semibold text-on-brand-tint">
            {eyebrow}
          </span>
        )}
        <h1 dir="auto" className="t-h2 text-ink">
          {title}
        </h1>
        {subtitle && (
          <p dir="auto" className="mt-1 max-w-[62ch] t-body text-ink-muted">
            {subtitle}
          </p>
        )}
      </div>
      {extra && <div className="shrink-0">{extra}</div>}
    </div>
  );
}

/** A bordered card surface. Wrap a table so it reads as one panel. */
export function Panel({
  toolbar,
  children,
  className,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ui-panel", className)}>
      {toolbar && <div className="ui-panel__toolbar">{toolbar}</div>}
      {children}
    </div>
  );
}

/** Labeled filter control used in toolbars. */
export function FilterField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="t-caption font-semibold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

/** Label / value row used inside detail drawers. */
export function DetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="t-small text-ink-muted">{label}</span>
      <span dir="auto" className="text-end t-small font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}
