"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, MessageCircle } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { listSlots, type Slot } from "@/lib/bookings";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import SlotCalendar from "@/components/bookings/slot-calendar";

type Dict = Dictionary["browse"];

const HORIZON_DAYS = 21;

/**
 * Teacher schedule: a month calendar of open days (see SlotCalendar) — pick a
 * day, then a time. Times render in the viewer's local timezone (slots arrive
 * as UTC). Picking a time calls `onPick(startIso)`.
 */
export default function TeacherSchedule({
  teacherId,
  stageId = null,
  locale,
  dict,
  onPick,
  onMessage,
  selected,
}: {
  teacherId: number;
  /** Show only this stage card's hours (null: all of the teacher's stages). */
  stageId?: number | null;
  locale: Locale;
  dict: Dict;
  onPick: (startIso: string) => void;
  onMessage?: () => void;
  selected?: string;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listSlots(teacherId, HORIZON_DAYS, stageId)
      .then((s) => active && setSlots(s))
      .catch(() => active && setSlots([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [teacherId, stageId]);

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <Skeleton className="h-64 w-full max-w-[17rem] rounded-card" />
        <div className="flex flex-1 flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock aria-hidden />}
        title={dict.noSlots}
        action={
          onMessage ? (
            <Button variant="outline" onClick={onMessage}>
              <MessageCircle aria-hidden />
              {dict.message}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="t-caption text-ink-faint">{dict.timezoneNote.replace("{tz}", tz)}</span>
      <SlotCalendar
        slots={slots}
        selected={selected}
        onPick={onPick}
        locale={locale}
        hint={dict.pickTimePrompt}
      />
    </div>
  );
}
