"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/cn";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  text: string;
  variant: ToastVariant;
}

export interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const DURATION = 5000;

/**
 * Replaces antd's `message`. Deliberately hand-rolled rather than another
 * dependency: it is a list, a timer and a portal-free fixed container.
 *
 * Errors get `role="alert"` (announced immediately) and everything else
 * `role="status"`, because an error here usually means the student's money or
 * booking did not go through.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);
  const timers = React.useRef<number[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = React.useMemo<ToastApi>(() => {
    const push = (text: string, variant: ToastVariant) => {
      const id = ++seq.current;
      setItems((prev) => [...prev, { id, text, variant }]);
      timers.current.push(
        window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), DURATION),
      );
    };
    return {
      success: (text) => push(text, "success"),
      error: (text) => push(text, "error"),
      info: (text) => push(text, "info"),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        /* Clears the fixed app header; `pointer-events-none` on the stack so it
           never blocks the page, re-enabled on each toast. */
        className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const icons = { success: CheckCircle2, error: AlertTriangle, info: Info } as const;
const iconColor = {
  success: "text-success",
  error: "text-error",
  info: "text-brand",
} as const;

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = icons[item.variant];
  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-2.5",
        "rounded-card border border-border bg-surface p-3.5 shadow-lg",
        "motion-safe:animate-dialog-in",
      )}
    >
      <Icon className={cn("mt-0.5 size-4.5 shrink-0", iconColor[item.variant])} aria-hidden />
      <p dir="auto" className="min-w-0 flex-1 t-small text-ink">
        {item.text}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close"
        className="-me-1 -mt-1 shrink-0 rounded-control p-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Toasts report what just happened to a request. If the provider is missing
 * the call is a no-op rather than a crash — a failed booking should still show
 * its inline error.
 */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  return ctx ?? noop;
}

const noop: ToastApi = { success: () => {}, error: () => {}, info: () => {} };
