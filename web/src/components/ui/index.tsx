"use client";

import type { ReactNode } from "react";
import { Typography } from "antd";

import { cn } from "@/lib/cn";

const { Title, Paragraph } = Typography;

/** Consistent page heading: optional eyebrow, strong title, muted subtitle, actions. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  extra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <span
            className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "var(--brand-tint)", color: "var(--on-brand-tint)" }}
          >
            {eyebrow}
          </span>
        )}
        <Title level={3} style={{ marginBottom: subtitle ? 2 : 0, fontFamily: "var(--font-display)" }}>
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
    <div className={cn("ui-panel", className)}>
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

/* ---------- Consumer (Preply-style) primitives ---------- */

/** Lighter section header than PageHeader: a title + optional trailing action. */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-lg font-bold sm:text-xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {children}
      </h2>
      {action && <div className="shrink-0 text-sm font-semibold" style={{ color: "var(--brand)" }}>{action}</div>}
    </div>
  );
}

export interface SegmentOption {
  value: string;
  label: ReactNode;
  badge?: number;
}

/** Pill segmented control — replaces antd Tabs on consumer screens. Scrolls on mobile. */
export function SegmentedTabs({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SegmentOption[];
  className?: string;
}) {
  return (
    <div
      className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-full p-1", className)}
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn("seg flex shrink-0 items-center gap-1.5 px-4 py-1.5 text-sm font-semibold", active && "is-active")}
          >
            {o.label}
            {o.badge != null && o.badge > 0 && (
              <span
                className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold"
                style={{ background: "var(--brand-tint)", color: "var(--on-brand-tint)" }}
              >
                {o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A single content row (avatar / title+meta / trailing) — replaces table rows. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-3 rounded-2xl p-3 sm:p-4", className)}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</div>
        {subtitle && <div className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-end">{trailing}</div>}
    </div>
  );
}

/** Slim inline stat strip — replaces heavy KPI StatCard grids. */
export function SummaryStrip({
  items,
  className,
}: {
  items: { label: ReactNode; value: ReactNode; icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl px-5 py-4", className)}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2.5">
          {it.icon && (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
              {it.icon}
            </span>
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-bold" style={{ color: "var(--ink)" }}>{it.value}</span>
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{it.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
