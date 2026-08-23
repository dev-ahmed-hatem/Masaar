"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Spin } from "antd";
import { ChevronLeft, ChevronRight, Clock, MessageCircle } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { listSlots, type Slot } from "@/lib/bookings";

type Dict = Dictionary["browse"];

const HORIZON_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local YYYY-M-D key for grouping slots by calendar day in the viewer's TZ. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Monday (local midnight) of the week containing `d`. */
function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (m.getDay() + 6) % 7; // 0=Sun..6=Sat -> days since Monday
  m.setDate(m.getDate() - shift);
  return m;
}

/**
 * Preply-style weekly schedule: day columns of clickable time chips, one week
 * at a time with prev/next navigation. Times render in the viewer's local
 * timezone (slots arrive as UTC). Picking a chip calls `onPick(startIso)`.
 */
export default function TeacherSchedule({
  teacherId,
  locale,
  dict,
  onPick,
  onMessage,
  selected,
}: {
  teacherId: number;
  locale: Locale;
  dict: Dict;
  onPick: (startIso: string) => void;
  onMessage?: () => void;
  selected?: string;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listSlots(teacherId, HORIZON_DAYS)
      .then((s) => active && setSlots(s))
      .catch(() => active && setSlots([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [teacherId]);

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = dayKey(new Date(s.start));
      const list = map.get(k);
      if (list) list.push(s);
      else map.set(k, [s]);
    }
    return map;
  }, [slots]);

  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const weekStart = useMemo(
    () => new Date(thisMonday.getTime() + weekOffset * 7 * DAY_MS),
    [thisMonday, weekOffset],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)),
    [weekStart],
  );

  // Last day that actually has a slot — bounds the "next" navigation.
  const lastSlotTime = slots.length ? new Date(slots[slots.length - 1].start).getTime() : 0;
  const canPrev = weekOffset > 0;
  const nextWeekStart = weekStart.getTime() + 7 * DAY_MS;
  const canNext = lastSlotTime >= nextWeekStart;

  const dateFmt = (d: Date) => d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  const timeFmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const weekLabel = `${dateFmt(days[0])} – ${dateFmt(days[6])}`;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spin />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Clock size={28} style={{ color: "var(--ink-faint)" }} />
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {dict.noSlots}
        </p>
        {onMessage && (
          <Button icon={<MessageCircle size={15} />} onClick={onMessage}>
            {dict.message}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Timezone + week navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          {dict.timezoneNote.replace("{tz}", tz)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            shape="circle"
            aria-label={dict.prevWeek}
            disabled={!canPrev}
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            icon={<ChevronLeft size={16} className="rtl:-scale-x-100" />}
          />
          <span className="min-w-[9rem] text-center text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {weekLabel}
          </span>
          <Button
            size="small"
            shape="circle"
            aria-label={dict.nextWeek}
            disabled={!canNext}
            onClick={() => setWeekOffset((w) => w + 1)}
            icon={<ChevronRight size={16} className="rtl:-scale-x-100" />}
          />
        </div>
      </div>

      {/* Week grid — scrolls horizontally on small screens */}
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[600px] grid-cols-7 gap-2">
          {days.map((d, i) => {
            const daySlots = byDay.get(dayKey(d)) ?? [];
            const isToday = dayKey(d) === dayKey(new Date());
            return (
              <div key={i} className="flex flex-col gap-2">
                <div className="text-center">
                  <div
                    className="text-xs font-semibold"
                    style={{ color: isToday ? "var(--brand)" : "var(--ink)" }}
                  >
                    {dict.weekdays[i]}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    {d.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {daySlots.length === 0 ? (
                    <span className="py-2 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
                      –
                    </span>
                  ) : (
                    daySlots.map((s) => {
                      const isSel = selected === s.start;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => onPick(s.start)}
                          dir="ltr"
                          className="rounded-lg border px-1.5 py-1.5 text-xs font-medium transition-colors"
                          style={
                            isSel
                              ? {
                                  background: "var(--brand)",
                                  borderColor: "var(--brand)",
                                  color: "#fff",
                                }
                              : {
                                  background: "var(--surface)",
                                  borderColor: "var(--border-strong)",
                                  color: "var(--ink)",
                                }
                          }
                        >
                          {timeFmt(s.start)}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
