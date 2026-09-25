import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Zero-state: one tinted geometric tile, a plain-spoken line about what is
 * missing, and — per the voice rule — exactly one next step. Replaces antd's
 * `Empty`, whose grey illustration is unmistakably enterprise.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          /* The rotated square behind the tile is the same 45° motif as the
             eight-point star in .pattern-bg — geometry, not a gradient blob. */
          className="relative mb-1 inline-flex size-16 items-center justify-center"
        >
          <span className="absolute inset-1.5 rotate-45 rounded-control bg-brand-tint" />
          <span className="absolute inset-1.5 rounded-control bg-brand-tint" />
          <span className="relative text-on-brand-tint [&_svg]:size-6">{icon}</span>
        </span>
      ) : null}

      <p className="t-h4 text-ink">{title}</p>

      {description ? (
        <p className="max-w-sm t-small text-ink-muted">{description}</p>
      ) : null}

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
