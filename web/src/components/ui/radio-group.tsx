"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/cn";

export const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(function RadioGroup({ className, ...props }, ref) {
  return <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />;
});

export const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "size-5 shrink-0 rounded-full border border-border-input bg-surface transition-colors",
        "data-[state=checked]:border-brand",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex size-full items-center justify-center">
        <span className="size-2.5 rounded-full bg-brand" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});

/**
 * Whole-card radio. Used for picking a payment account during wallet top-up,
 * where the tap target should be the entire card rather than a 20px dot.
 */
export function RadioCard({
  value,
  id,
  children,
  className,
}: {
  value: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-card border border-border bg-surface p-4 transition-colors",
        "hover:border-brand/50 has-[:checked]:border-brand has-[:checked]:bg-brand-tint",
        className,
      )}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
