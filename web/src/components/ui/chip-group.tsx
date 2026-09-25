"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Multi-select as a wrapped row of toggle chips.
 *
 * Deliberately not a dropdown: every list this serves is short (two teaching
 * languages, four to six subjects in a stage) and a chip row shows the whole
 * choice at once — no popover, no search, and it stays usable inside a dialog
 * on a phone.
 */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  label,
  invalid,
  className,
  id,
}: {
  options: ChipOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
  /** Accessible name for the group. */
  label?: string;
  invalid?: boolean;
  className?: string;
  id?: string;
}) {
  function toggle(v: T) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      /* No `aria-invalid` here: the role doesn't support it, and the Field's
         error message already announces the problem. This is the visual cue. */
      className={cn(
        "flex flex-wrap gap-2 rounded-card",
        invalid && "outline-2 outline-offset-4 outline-error/60",
        disabled && "opacity-60",
        className,
      )}
    >
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="checkbox"
            aria-checked={on}
            disabled={disabled}
            onClick={() => toggle(o.value)}
            dir="auto"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 t-small font-medium",
              "transition-colors disabled:cursor-not-allowed",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              on
                ? "border-brand bg-brand text-on-brand"
                : "border-border-input bg-surface text-ink-muted hover:border-brand hover:text-ink",
            )}
          >
            {on ? <Check className="size-3.5" aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
