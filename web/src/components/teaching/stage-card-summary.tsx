"use client";

import type { ReactNode } from "react";
import { Tag } from "antd";
import { CalendarClock, Gift } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import {
  refName,
  sortWindows,
  stageCardTitle,
  type StageCard,
} from "@/lib/stage-cards";

export type StageCardsDict = Dictionary["stageCards"];

/**
 * Read-only view of one stage card: stage/branch, its subjects, the price,
 * free trial lessons and weekly hours. `actions` renders in the header (edit /
 * remove / book), `footer` below the body.
 */
export default function StageCardSummary({
  card,
  dict,
  locale,
  actions,
  footer,
  highlight = false,
  showAvailability = true,
}: {
  card: StageCard;
  dict: StageCardsDict;
  locale: string;
  actions?: ReactNode;
  footer?: ReactNode;
  highlight?: boolean;
  showAvailability?: boolean;
}) {
  const windows = sortWindows(card.availability);
  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{
        border: `1px solid ${highlight ? "var(--warning)" : "var(--border)"}`,
        background: "var(--surface)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold" style={{ color: "var(--ink)" }}>
            {stageCardTitle(card, locale)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {card.price.amount_minor > 0 ? card.price.display : dict.notSet}
            </span>
            <span style={{ color: "var(--ink-faint)" }}>{dict.perLesson}</span>
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-1.5">{actions}</div>}
      </div>

      {card.incomplete && card.incomplete.length > 0 && (
        <div className="text-xs" style={{ color: "var(--warning)" }}>
          {dict.incomplete}:{" "}
          {card.incomplete
            .map((r) =>
              r === "subject" ? dict.missingSubject : r === "price" ? dict.missingPrice : dict.missingAvailability,
            )
            .join(" · ")}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {card.subjects.length === 0 ? (
          <span className="text-sm" style={{ color: "var(--ink-faint)" }}>{dict.noSubjects}</span>
        ) : (
          card.subjects.map((s) => (
            <Tag
              key={s.id}
              bordered={false}
              style={{ background: "var(--brand-tint)", color: "var(--brand-dark)", margin: 0 }}
            >
              {refName(s, locale)}
            </Tag>
          ))
        )}
      </div>

      <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--ink-muted)" }}>
        <Gift size={14} />
        {card.free_lessons_offered > 0
          ? dict.trials.replace("{n}", String(card.free_lessons_offered))
          : dict.noTrials}
      </div>

      {showAvailability && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm" style={{ color: "var(--ink-muted)" }}>
          <CalendarClock size={14} />
          {windows.length === 0 ? (
            <span style={{ color: "var(--ink-faint)" }}>{dict.noAvailability}</span>
          ) : (
            windows.map((w, i) => (
              <Tag key={i} style={{ margin: 0 }}>
                {dict.weekdays[w.weekday]} {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)}
              </Tag>
            ))
          )}
        </div>
      )}

      {footer}
    </div>
  );
}
