"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Colour discipline (see globals.css and src/design/tokens.ts):
 *   brand  — teal. The everyday in-app action. Use this by default.
 *   accent — amber. The conversion CTA only: sign up, book, top up.
 *            Roughly one per view. Amber takes INK text, never white
 *            (white on #E8A33D is 2.16:1 and fails AA).
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "motion-safe:active:translate-y-px",
  ),
  {
    variants: {
      variant: {
        brand: "bg-brand text-on-brand shadow-sm hover:bg-brand-dark",
        accent: "bg-accent text-on-accent shadow-sm hover:bg-accent-dark",
        outline:
          "bg-surface text-ink border border-border-strong hover:border-brand hover:text-brand",
        ghost: "bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
        subtle: "bg-brand-tint text-brand-dark hover:bg-brand hover:text-on-brand",
        danger: "bg-error text-white shadow-sm hover:opacity-90",
        link: "bg-transparent text-brand underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-9 px-3.5 text-sm rounded-control [&_svg]:size-4",
        md: "h-11 px-5 text-[0.9375rem] rounded-control [&_svg]:size-4",
        lg: "h-[52px] px-7 text-base rounded-control [&_svg]:size-5",
        icon: "h-11 w-11 rounded-control [&_svg]:size-5",
        "icon-sm": "h-9 w-9 rounded-control [&_svg]:size-4",
      },
      pill: { true: "rounded-pill", false: "" },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "brand", size: "md", pill: false, block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. a next/link) instead of a <button>. */
  asChild?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, pill, block, asChild, loading, children, disabled, ...props },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, pill, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </Comp>
    );
  },
);

export { buttonVariants };
