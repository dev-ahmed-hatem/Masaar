"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Read-only rating.
 *
 * `compact` (the default) is one star plus the number — right for dense lists
 * where the exact score matters more than the picture. `stars` draws all five,
 * which reads better on a review card. Either way the accessible name is a
 * single phrase, not five decorative icons.
 */
export function Rating({
  value,
  count,
  size = "md",
  showValue = true,
  display = "compact",
  className,
}: {
  value: number;
  /** Review count, rendered as "(123)" when provided. */
  count?: number | null;
  size?: "sm" | "md";
  showValue?: boolean;
  display?: "compact" | "stars";
  className?: string;
}) {
  const rounded = Math.round(value * 10) / 10;

  if (display === "stars") {
    return (
      <span
        className={cn("inline-flex items-center gap-0.5", className)}
        role="img"
        aria-label={`${rounded} / 5`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            aria-hidden
            className={cn(
              size === "sm" ? "size-3.5" : "size-4",
              n <= Math.round(value)
                ? "fill-accent text-accent"
                : "fill-transparent text-border-strong",
            )}
          />
        ))}
        {typeof count === "number" ? (
          <span className="ms-1.5 t-caption font-normal text-ink-muted">({count})</span>
        ) : null}
      </span>
    );
  }

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
