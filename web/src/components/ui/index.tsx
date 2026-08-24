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
            style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}
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

/** Gradient-text section heading for marketing / dashboard sections. */
export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn("gradient-text text-2xl font-bold tracking-tight sm:text-3xl", className)}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </h2>
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

/** Frosted glass card — for hero/dashboard highlight surfaces. */
export function GlassCard({
  children,
  className,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn("glass rounded-3xl p-6", interactive && "surface-hover", className)}
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      {children}
    </div>
  );
}

/** Rounded gradient-tinted container for an icon. */
export function IconChip({
  children,
  size = 44,
  variant = "gradient",
}: {
  children: ReactNode;
  size?: number;
  variant?: "gradient" | "soft";
}) {
  const gradient = variant === "gradient";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: gradient ? "var(--grad-brand)" : "var(--brand-tint)",
        color: gradient ? "#fff" : "var(--brand)",
        boxShadow: gradient ? "var(--glow)" : "none",
      }}
    >
      {children}
    </span>
  );
}

/** Dashboard stat tile: icon chip + big value + label + optional hint. */
export function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="surface surface-hover flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
          {label}
        </span>
        {icon && <IconChip size={38}>{icon}</IconChip>}
      </div>
      <div
        className="text-3xl font-bold tracking-tight"
        style={{ color: accent ?? "var(--ink)", fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      {hint && (
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          {hint}
        </span>
      )}
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

/** Empty / zero-state with an icon chip, title and optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && (
        <IconChip size={56} variant="soft">
          {icon}
        </IconChip>
      )}
      <div className="text-base font-semibold" style={{ color: "var(--ink)" }}>
        {title}
      </div>
      {description && (
        <p className="max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
          {description}
        </p>
      )}
      {action}
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
            className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-muted)",
              boxShadow: active ? "var(--shadow-sm)" : "none",
            }}
          >
            {o.label}
            {o.badge != null && o.badge > 0 && (
              <span
                className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold"
                style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}
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
