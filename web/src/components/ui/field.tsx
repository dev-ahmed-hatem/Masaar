"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Label } from "./label";

/**
 * One labelled form row: label, control, and either a hint or an error.
 * Wires up htmlFor / aria-describedby / aria-invalid so callers don't have to.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      ) : null}

      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {error ? (
        <p id={`${id}-error`} role="alert" className="t-caption text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="t-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
