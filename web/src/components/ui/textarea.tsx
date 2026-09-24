"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { inputBase } from "./input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(inputBase, "min-h-24 px-3.5 py-2.5 text-[0.9375rem] leading-relaxed resize-y", className)}
      {...props}
    />
  );
});
