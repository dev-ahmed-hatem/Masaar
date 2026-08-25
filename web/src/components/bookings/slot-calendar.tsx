"use client";

import { useMemo, useState } from "react";
import { Calendar } from "antd";
import dayjs, { type Dayjs } from "dayjs";

import type { Locale } from "@/i18n/config";
import { type Slot } from "@/lib/bookings";

const keyOf = (d: Dayjs) => d.format("YYYY-MM-DD");

/**
 * Shared calendar-style slot picker used everywhere a lesson time is chosen
 * (student booking + reschedule). A month calendar (antd `Calendar`) where days
 * with open slots are enabled and show their count; picking a day reveals that
 * day's time chips. Slots arrive as UTC ISO strings and render in the viewer's
 * local timezone.
 */
export default function SlotCalendar({
  slots,
  selected,
  onPick,
  locale,
  hint,
}: {
  slots: Slot[];
  selected?: string;
  onPick: (startIso: string) => void;
  locale: Locale;
  hint?: string;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = keyOf(dayjs(s.start));
      const arr = map.get(k);
      if (arr) arr.push(s);
      else map.set(k, [s]);
    }
    return map;
  }, [slots]);

  const firstKey = slots.length ? keyOf(dayjs(slots[0].start)) : null;
  const selectedKey = selected ? keyOf(dayjs(selected)) : null;
  const initialKey = selectedKey && byDay.has(selectedKey) ? selectedKey : firstKey;

  // Parents only mount this once the (non-empty) slot set has loaded, so the
  // initial anchor is stable — no effect needed to re-sync.
  const [day, setDay] = useState<string | null>(initialKey);
  const [panel, setPanel] = useState<Dayjs>(() => (initialKey ? dayjs(initialKey) : dayjs()));

  const dayChips = day ? byDay.get(day) ?? [] : [];

  const timeFmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="slot-calendar flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="slot-calendar-panel">
        <Calendar
          fullscreen={false}
          value={panel}
          disabledDate={(d) => !byDay.has(keyOf(d))}
          onSelect={(d, info) => {
            setPanel(d);
            if (info.source === "date" && byDay.has(keyOf(d))) setDay(keyOf(d));
          }}
          onPanelChange={(d) => setPanel(d)}
          cellRender={(d, info) => {
            // antd renders the date number itself; this fills the cell's
            // content slot beneath it. Return only the open-slot count.
            if (info.type !== "date") return null;
            const n = byDay.get(keyOf(d))?.length;
            return n ? <span className="slot-count">{n}</span> : null;
          }}
        />
      </div>

      <div className="flex-1">
        {hint && (
          <p className="mb-3 text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
            {hint}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {dayChips.length === 0 ? (
            <span className="text-sm" style={{ color: "var(--ink-faint)" }}>
              —
            </span>
          ) : (
            dayChips.map((s) => (
              <button
                key={s.start}
                type="button"
                dir="ltr"
                onClick={() => onPick(s.start)}
                className={`slot-chip px-3 py-1.5 text-sm font-medium${selected === s.start ? " is-active" : ""}`}
              >
                {timeFmt(s.start)}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
