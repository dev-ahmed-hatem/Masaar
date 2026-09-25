"use client";

import { useMemo, useState } from "react";

import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { type Slot } from "@/lib/bookings";
import { Calendar } from "@/components/ui/calendar";

/** Local calendar key for a Date — never `toISOString`, which shifts to UTC. */
function keyOf(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Shared calendar-style slot picker used everywhere a lesson time is chosen
 * (student booking + reschedule). Days with open slots are selectable and
 * carry a dot with their count; picking a day reveals that day's time chips.
 * Slots arrive as UTC ISO strings and render in the viewer's local timezone.
 */
export default function SlotCalendar({
  slots,
  selected,
  onPick,
  locale,
  hint,
  emptyLabel,
}: {
  slots: Slot[];
  selected?: string;
  onPick: (startIso: string) => void;
  locale: Locale;
  hint?: string;
  /** Shown in the times column before a day is chosen. */
  emptyLabel?: string;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = keyOf(new Date(s.start));
      const arr = map.get(k);
      if (arr) arr.push(s);
      else map.set(k, [s]);
    }
    return map;
  }, [slots]);

  const openDays = useMemo(
    () => [...byDay.keys()].map((k) => new Date(`${k}T12:00:00`)),
    [byDay],
  );

  const firstStart = slots.length ? new Date(slots[0].start) : null;
  const selectedStart = selected ? new Date(selected) : null;
  const initial =
    selectedStart && byDay.has(keyOf(selectedStart)) ? selectedStart : firstStart;

  // Parents only mount this once the (non-empty) slot set has loaded, so the
  // initial anchor is stable — no effect needed to re-sync.
  const [day, setDay] = useState<Date | undefined>(initial ?? undefined);
  const dayKey = day ? keyOf(day) : null;
  const dayChips = dayKey ? byDay.get(dayKey) ?? [] : [];

  const timeFmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const last = openDays.length ? openDays[openDays.length - 1] : undefined;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
      <Calendar
        locale={locale}
        mode="single"
        selected={day}
        onSelect={(d) => d && setDay(d)}
        defaultMonth={initial ?? undefined}
        startMonth={new Date()}
        endMonth={last}
        /* Only days the teacher actually has hours for are reachable. */
        disabled={(d) => !byDay.has(keyOf(d))}
        modifiers={{ open: openDays }}
        modifiersClassNames={{
          open: "after:absolute after:bottom-1 after:start-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-brand after:content-[''] rtl:after:translate-x-1/2",
        }}
        classNames={{
          /* The open-day dot would disappear into the selected day's teal
             fill; `!` because DayPicker joins these classes and CSS order,
             not class order, would otherwise decide the winner. */
          selected:
            "[&>button]:bg-brand [&>button]:text-on-brand [&>button]:font-bold [&>button:hover]:bg-brand-dark [&>button:hover]:text-on-brand after:bg-on-brand!",
        }}
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        {hint ? <p className="mb-3 t-small font-semibold text-ink">{hint}</p> : null}
        <div className="flex flex-wrap gap-2">
          {dayChips.length === 0 ? (
            <span className="t-small text-ink-faint">{emptyLabel ?? "—"}</span>
          ) : (
            dayChips.map((s) => {
              const active = selected === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  dir="ltr"
                  aria-pressed={active}
                  onClick={() => onPick(s.start)}
                  className={cn(
                    "rounded-control border px-3.5 py-2 t-small font-semibold transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    active
                      ? "border-brand bg-brand text-on-brand"
                      : "border-border-input bg-surface text-ink hover:border-brand hover:text-brand",
                  )}
                >
                  {timeFmt(s.start)}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
