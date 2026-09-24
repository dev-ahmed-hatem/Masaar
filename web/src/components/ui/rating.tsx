"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Read-only star rating. Renders a single accessible number for screen
 * readers rather than five decorative icons.
 */
export function Rating({
  value,
  count,
  size = "md",
  showValue = true,
  className,
}: {
  value: number;
  /** Review count, rendered as "(123)" when provided. */
  count?: number | null;
  size?: "sm" | "md";
  showValue?: boolean;
  className?: string;
}) {
  const rounded = Math.round(value * 10) / 10;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold text-ink",
        size === "sm" ? "t-caption" : "t-small",
        className,
      )}
    >
      <Star
        aria-hidden
        className={cn("fill-accent text-accent", size === "sm" ? "size-3.5" : "size-4")}
      />
      {showValue ? <span>{rounded.toFixed(1)}</span> : null}
      {typeof count === "number" ? (
        <span className="text-ink-muted font-normal">({count})</span>
      ) : null}
    </span>
  );
}

/** Interactive 1–5 picker for the post-lesson review form. */
export function RatingInput({
  value,
  onChange,
  name,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  name?: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          name={name}
          aria-checked={value === n}
          aria-label={String(n)}
          onClick={() => onChange(n)}
          className="rounded-control p-1 transition-transform motion-safe:hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Star
            aria-hidden
            className={cn(
              "size-7 transition-colors",
              n <= value ? "fill-accent text-accent" : "fill-transparent text-border-strong",
            )}
          />
        </button>
      ))}
    </div>
  );
}
