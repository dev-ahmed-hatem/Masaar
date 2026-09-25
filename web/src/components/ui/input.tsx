"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * `border-border-input` is deliberately darker than the card hairline: a
 * control's boundary must clear 3:1 against every surface it sits on
 * (WCAG 1.4.11). See scripts/check-contrast.mjs.
 */
export const inputBase = cn(
  "w-full bg-surface text-ink placeholder:text-ink-faint",
  "border border-border-input rounded-control",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-brand/60",
  "focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20",
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-2",
  "aria-[invalid=true]:border-error aria-[invalid=true]:focus:ring-error/20",
);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Rendered at the inline-start edge (search icon, currency, flag). */
  startSlot?: React.ReactNode;
  /** Rendered at the inline-end edge (clear button, unit). */
  endSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, startSlot, endSlot, ...props },
  ref,
) {
  if (!startSlot && !endSlot) {
    return (
      <input ref={ref} className={cn(inputBase, "h-11 px-3.5 text-[0.9375rem]", className)} {...props} />
    );
  }
  return (
    /* The wrapper carries the border so the slots sit inside the field, and it
       repeats the field's `dir`: a phone number is LTR, so its dial-code slot
       must sit to the LEFT of the digits even on /ar. */
    <div
      dir={props.dir}
      className={cn(inputBase, "input-shell flex h-11 items-center gap-2 px-3.5", className)}
    >
      {startSlot ? (
        <span className="text-ink-faint flex shrink-0 items-center [&_svg]:size-4">{startSlot}</span>
      ) : null}
      <input
        ref={ref}
        className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed"
        {...props}
      />
      {endSlot ? (
        <span className="text-ink-faint flex shrink-0 items-center [&_svg]:size-4">{endSlot}</span>
      ) : null}
    </div>
  );
});
