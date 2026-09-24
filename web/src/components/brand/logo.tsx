import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * The Wisal identity.
 *
 * Replaces the lucide `GraduationCap`-in-a-gradient-tile that used to be
 * duplicated inline in app-header.tsx, (auth)/layout.tsx and site-footer.tsx.
 *
 * The symbol is inlined rather than loaded from /public/brand/wisal/symbol.svg
 * so it can inherit `currentColor` in the mono variant and never flashes.
 * Keep it in sync with that file if either changes.
 *
 * The wordmark is live text in the display face (Readex Pro), not an outlined
 * path, so it renders as وصال on /ar and Wisal on /en from one component and
 * stays crisp at every size.
 */

const WORDMARK: Record<string, string> = { ar: "وصال", en: "Wisal" };

export function WisalSymbol({
  className,
  mono = false,
  title,
}: {
  className?: string;
  /** Single-colour cut: both rings inherit currentColor. */
  mono?: boolean;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <g fill="none" strokeWidth="5" strokeLinecap="round">
        <circle cx="18" cy="24" r="10.5" stroke={mono ? "currentColor" : "var(--brand)"} />
        {/* Open arc, not a full circle — the gap is where the teal ring
            crosses over, and it is what makes the two rings read as woven. */}
        <path
          d="M 27.66 13.76 A 10.5 10.5 0 1 1 21.21 18.26"
          stroke={mono ? "currentColor" : "var(--accent)"}
        />
      </g>
    </svg>
  );
}

const symbolSize = {
  sm: "size-7",
  md: "size-9",
  lg: "size-12",
} as const;

const wordSize = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
} as const;

export function Logo({
  locale,
  size = "md",
  variant = "horizontal",
  mono = false,
  className,
}: {
  locale: string;
  size?: keyof typeof symbolSize;
  /** `symbol` omits the wordmark — only once "Wisal" is clear from context. */
  variant?: "horizontal" | "stacked" | "symbol";
  mono?: boolean;
  className?: string;
}) {
  const word = WORDMARK[locale] ?? WORDMARK.en;

  if (variant === "symbol") {
    return <WisalSymbol className={cn(symbolSize[size], className)} mono={mono} title={word} />;
  }

  return (
    <span
      className={cn(
        "inline-flex select-none",
        variant === "stacked" ? "flex-col items-center gap-2" : "flex-row items-center gap-2.5",
        className,
      )}
    >
      <WisalSymbol className={cn(symbolSize[size], "shrink-0")} mono={mono} />
      <span
        className={cn(
          "font-display font-bold leading-none tracking-tight",
          mono ? "text-current" : "text-ink",
          wordSize[size],
        )}
      >
        {word}
      </span>
    </span>
  );
}
