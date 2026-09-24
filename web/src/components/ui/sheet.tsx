"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

import { DialogOverlay } from "./dialog";

/**
 * Edge-anchored panel. `side="bottom"` is the mobile default for filters and
 * booking; `start`/`end` are LOGICAL, so they flip correctly under RTL.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sheetVariants = cva(
  cn(
    "fixed z-50 bg-surface border-border shadow-lg flex flex-col",
    "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
  ),
  {
    variants: {
      side: {
        bottom:
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-panel border-t pb-[env(safe-area-inset-bottom)]",
        top: "inset-x-0 top-0 max-h-[85dvh] rounded-b-panel border-b",
        start: "inset-y-0 start-0 w-[min(24rem,90vw)] border-e",
        end: "inset-y-0 end-0 w-[min(24rem,90vw)] border-s",
      },
    },
    defaultVariants: { side: "bottom" },
  },
);

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof sheetVariants> & { hideClose?: boolean }
>(function SheetContent({ className, children, side, hideClose, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {side === "bottom" ? (
          /* Drag affordance — signals the sheet is dismissible. */
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-pill bg-border-strong" aria-hidden />
        ) : null}
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute end-4 top-4 rounded-control p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pe-14", className)} {...props} />;
}
export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-5 pb-5", className)} {...props} />;
}
export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex gap-2 border-t border-border p-5", className)} {...props} />
  );
}

export const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return <DialogPrimitive.Title ref={ref} className={cn("t-h3 text-ink", className)} {...props} />;
});

export const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description ref={ref} className={cn("t-small text-ink-muted", className)} {...props} />
  );
});
