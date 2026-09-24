import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const alertVariants = cva("flex gap-3 rounded-card border p-4", {
  variants: {
    variant: {
      info: "bg-brand-tint border-brand/20 text-ink",
      success: "bg-success-tint border-success/25 text-ink",
      warning: "bg-warning-tint border-accent/30 text-ink",
      error: "bg-error-tint border-error/25 text-ink",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const iconColor = {
  info: "text-brand",
  success: "text-success",
  warning: "text-accent-text",
  error: "text-error",
} as const;

export interface AlertProps
  /* `title` is omitted because the HTML title attribute is string-only and we
     want to accept rich nodes for the heading. */
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
  /** Trailing action (a link or button). */
  action?: React.ReactNode;
}

export function Alert({ className, variant = "info", title, action, children, ...props }: AlertProps) {
  const v = variant ?? "info";
  const Icon = icons[v];
  return (
    <div
      role={v === "error" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconColor[v])} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="t-small font-semibold text-ink">{title}</p> : null}
        {children ? <div className="t-small text-ink-muted">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
