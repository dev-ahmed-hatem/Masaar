"use client";

import type { ReactNode } from "react";

/**
 * Shared chrome for the six auth forms: heading, optional lead paragraph,
 * the form, and a footer line. No card — on `lg` the page is already two
 * panels, and on a phone a card floating on the canvas is one border too many.
 */
export function AuthPanel({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="t-h2 text-ink">{title}</h1>
        {subtitle ? <p className="mt-2 t-body text-ink-muted">{subtitle}</p> : null}
      </header>
      {children}
      {footer ? <p className="text-center t-small text-ink-muted">{footer}</p> : null}
    </div>
  );
}

/** The vertical rhythm every auth form uses between its fields. */
export function AuthForm({
  onSubmit,
  children,
}: {
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}) {
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {children}
    </form>
  );
}
