"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";

/** Middle window of page numbers, with `-1` standing in for an ellipsis. */
function pagesFor(page: number, last: number): number[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < last);
  const out: number[] = [1];
  if (around[0]! > 2) out.push(-1);
  out.push(...around);
  if (around[around.length - 1]! < last - 1) out.push(-1);
  out.push(last);
  return out;
}

/**
 * Page numbers for a paginated list. Renders nothing when everything fits on
 * one page. The chevrons are mirrored under RTL, where "next" points start-ward.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  prevLabel,
  nextLabel,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  prevLabel: string;
  nextLabel: string;
  className?: string;
}) {
  const last = Math.ceil(total / pageSize);
  if (last <= 1) return null;

  const step = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-control px-2.5 t-small font-semibold",
    "text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  );

  return (
    <nav className={cn("flex items-center justify-center gap-1", className)}>
      <button
        type="button"
        className={step}
        aria-label={prevLabel}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
      </button>

      {pagesFor(page, last).map((p, i) =>
        p === -1 ? (
          <span key={`gap-${i}`} className="px-1 t-small text-ink-faint" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p)}
            className={cn(
              step,
              p === page &&
                "bg-brand text-on-brand hover:bg-brand-dark hover:text-on-brand shadow-sm",
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        className={step}
        aria-label={nextLabel}
        disabled={page >= last}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden />
      </button>
    </nav>
  );
}
