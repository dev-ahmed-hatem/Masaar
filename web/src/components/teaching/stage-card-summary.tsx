"use client";

import type { ReactNode } from "react";
import { CalendarClock, Gift } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import {
  refName,
  sortWindows,
  stageCardTitle,
  type StageCard,
} from "@/lib/stage-cards";
import { Badge } from "@/components/ui/badge";

export type StageCardsDict = Dictionary["stageCards"];

/**
 * Read-only view of one stage card: stage/branch, its subjects, the price,
 * free trial lessons and weekly hours. `actions` renders in the header (edit /
 * remove / book), `footer` below the body.
 *
 * Shared by the public teacher profile and the teacher's own editor, so it
 * must read well both as a sales card and as a settings row.
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
  const priced = card.price.amount_minor > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card border bg-surface p-4",
        highlight ? "border-accent" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div dir="auto" className="font-display font-semibold text-ink">
            {stageCardTitle(card, locale)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 t-small">
            <span className={cn("font-bold", priced ? "text-ink" : "text-ink-faint")}>
              {priced ? card.price.display : dict.notSet}
            </span>
            <span className="text-ink-faint">{dict.perLesson}</span>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-1.5">{actions}</div> : null}
      </div>

      {card.incomplete && card.incomplete.length > 0 ? (
        <p className="t-caption text-accent-text">
          {dict.incomplete}:{" "}
          {card.incomplete
            .map((r) =>
              r === "subject" ? dict.missingSubject : r === "price" ? dict.missingPrice : dict.missingAvailability,
            )
            .join(" · ")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {card.subjects.length === 0 ? (
          <span className="t-small text-ink-faint">{dict.noSubjects}</span>
        ) : (
          card.subjects.map((s) => (
            <Badge key={s.id} variant="brand" size="sm" dir="auto">
              {refName(s, locale)}
            </Badge>
          ))
        )}
      </div>

      <div className="flex items-center gap-1.5 t-small text-ink-muted">
        <Gift className="size-4 shrink-0" aria-hidden />
        {card.free_lessons_offered > 0
          ? dict.trials.replace("{n}", String(card.free_lessons_offered))
          : dict.noTrials}
      </div>

      {showAvailability ? (
        <div className="flex flex-wrap items-center gap-1.5 t-small text-ink-muted">
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          {windows.length === 0 ? (
            <span className="text-ink-faint">{dict.noAvailability}</span>
          ) : (
            windows.map((w, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-control bg-surface-2 px-2 py-0.5 t-caption"
              >
                {dict.weekdays[w.weekday]}
                <span dir="ltr">
                  {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)}
                </span>
              </span>
            ))
          )}
        </div>
      ) : null}

      {footer}
    </div>
  );
}
