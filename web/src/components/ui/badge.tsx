import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Every tinted variant pairs a tint background with its AA-verified text
 * colour — notably `trial`, which uses --accent-text (a deep bronze) rather
 * than raw amber, which would be unreadable on the amber tint.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill font-semibold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-ink-muted",
        brand: "bg-brand-tint text-brand-dark",
        solid: "bg-brand text-on-brand",
        /** Free-trial badge — the sanctioned amber usage. */
        trial: "bg-accent-tint text-accent-text",
        success: "bg-success-tint text-success",
        warning: "bg-warning-tint text-accent-text",
        error: "bg-error-tint text-error",
        outline: "border border-border-strong text-ink-muted",
      },
      size: {
        sm: "h-6 px-2.5 text-[0.6875rem]",
        md: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
