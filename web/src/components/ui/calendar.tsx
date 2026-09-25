"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ar, enUS } from "react-day-picker/locale";

import { cn } from "@/lib/cn";

/**
 * `DayPickerProps` is a union discriminated on `mode`, and a plain `Omit`
 * collapses it — which would lose `selected`/`onSelect`. Distribute instead.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type CalendarProps = DistributiveOmit<DayPickerProps, "locale"> & {
  locale: "ar" | "en";
};

/**
 * Month calendar. Replaces antd's `Calendar`, which carried enterprise
 * chrome (year/month dropdowns, a Month|Year toggle) into a flow where the
 * student is only picking a day.
 *
 * Two deliberate settings:
 * - the week starts **Saturday** in both locales, matching the markets we
 *   serve and the teacher's own weekly grid (`calendar-view.tsx`);
 * - numerals stay Latin even on `/ar`, because prices, times and lesson counts
 *   everywhere else in the app are Latin, and mixing the two in one view reads
 *   as a bug.
 */
export function Calendar({ locale, className, classNames, ...props }: CalendarProps) {
  const cellBase =
    "relative size-9 p-0 text-center [&:has([aria-selected])]:bg-transparent";

  const merged = {
    locale: locale === "ar" ? ar : enUS,
    dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const),
    weekStartsOn: 6 as const,
    numerals: "latn" as const,
    showOutsideDays: true,
    components: {
      Chevron: ({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) => {
      const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
      return <Icon className="size-4" aria-hidden />;
      },
    },
    /* `relative` matters: DayPicker renders Nav as a sibling of the months, and
       the absolute nav below would otherwise anchor to whatever dialog or card
       contains the calendar — the chevrons ended up on the dialog's edges. */
    className: cn("relative w-fit select-none", className),
    classNames: {
      months: "flex flex-col gap-4",
      month: "flex flex-col gap-3",
      month_caption: "flex h-9 items-center justify-center px-9",
      caption_label: "font-display text-[0.9375rem] font-semibold text-ink",
      nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
        button_previous:
        "inline-flex size-8 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35",
        button_next:
        "inline-flex size-8 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35",
      month_grid: "w-full border-collapse",
      weekdays: "flex",
      weekday: "size-9 t-caption font-semibold text-ink-faint",
      week: "flex w-full",
        day: cellBase,
        day_button: cn(
        "flex size-9 items-center justify-center rounded-control t-small font-medium text-ink",
        "transition-colors hover:bg-brand-tint hover:text-on-brand-tint",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
      ),
        selected:
        "[&>button]:bg-brand [&>button]:text-on-brand [&>button]:font-bold [&>button:hover]:bg-brand-dark [&>button:hover]:text-on-brand",
      today: "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-brand",
      outside: "[&>button]:text-ink-faint [&>button]:opacity-60",
      disabled: "[&>button]:text-ink-faint [&>button]:opacity-40 [&>button]:pointer-events-none",
      hidden: "invisible",
      ...classNames,
    },
    ...props,
  } as DayPickerProps;

  return <DayPicker {...merged} />;
}
