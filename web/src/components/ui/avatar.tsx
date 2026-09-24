"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const avatarVariants = cva("relative flex shrink-0 overflow-hidden bg-brand-tint", {
  variants: {
    size: {
      xs: "size-8 rounded-control",
      sm: "size-10 rounded-control",
      md: "size-14 rounded-card",
      lg: "size-20 rounded-card",
      xl: "size-28 rounded-card",
    },
    shape: { square: "", circle: "rounded-full" },
  },
  defaultVariants: { size: "md", shape: "square" },
});

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  src?: string | null;
  /** Full name; the first letter becomes the fallback glyph. */
  name?: string | null;
}

export function Avatar({ className, size, shape, src, name, ...props }: AvatarProps) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <AvatarPrimitive.Root className={cn(avatarVariants({ size, shape }), className)} {...props}>
      {src ? (
        <AvatarPrimitive.Image src={src} alt={name ?? ""} className="size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        className="text-brand-dark flex size-full items-center justify-center font-display font-bold"
        /* No delay: teachers without a photo should not flash an empty box. */
        delayMs={src ? 300 : 0}
      >
        {initial}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
