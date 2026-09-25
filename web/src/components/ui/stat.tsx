import * as React from "react";

import { cn } from "@/lib/cn";
import { Card } from "./card";

/**
 * One number with its label and a tinted glyph — the row that answers "how am
 * I doing?" on both dashboards and the earnings page. Replaces the old
 * `SummaryStrip`, whose items ran together on narrow screens.
 */
export function Stat({
  icon,
  label,
  value,
  action,
  className,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Trailing link (e.g. "Top up wallet"). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex items-center gap-3 p-4", className)}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-tint text-on-brand-tint [&_svg]:size-4.5">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span dir="auto" className="truncate font-display text-lg font-bold text-ink">
          {value}
        </span>
        <span className="t-caption text-ink-muted">{label}</span>
      </div>
      {action ? <div className="ms-auto shrink-0">{action}</div> : null}
    </Card>
  );
}
