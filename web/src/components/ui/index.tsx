"use client";

import type { ReactNode } from "react";
import { Typography } from "antd";

const { Title, Paragraph } = Typography;

/** Consistent page heading: strong title, muted subtitle, optional actions. */
export function PageHeader({
  title,
  subtitle,
  extra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <Title level={3} style={{ marginBottom: subtitle ? 2 : 0 }}>
          {title}
        </Title>
        {subtitle && (
          <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: "62ch" }}>
            {subtitle}
          </Paragraph>
        )}
      </div>
      {extra && <div className="shrink-0">{extra}</div>}
    </div>
  );
}

/** A bordered card surface. Wrap a table so it reads as one panel. */
export function Panel({
  toolbar,
  children,
  className,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-panel ${className ?? ""}`}>
      {toolbar && <div className="ui-panel__toolbar">{toolbar}</div>}
      {children}
    </div>
  );
}

/** Labeled filter control used in toolbars. */
export function FilterField({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

/** Label / value row used inside detail drawers. */
export function DetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
        {label}
      </span>
      <span className="text-end text-sm font-medium">{value}</span>
    </div>
  );
}
