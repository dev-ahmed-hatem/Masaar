"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(function Label({ className, required, children, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("t-small font-semibold text-ink select-none", className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="text-error ms-1" aria-hidden>
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
});
