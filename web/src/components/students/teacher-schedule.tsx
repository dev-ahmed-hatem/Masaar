"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Spin } from "antd";
import { Clock, MessageCircle } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { listSlots, type Slot } from "@/lib/bookings";
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

  useEffect(() => {
    let active = true;
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
      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
        {dict.timezoneNote.replace("{tz}", tz)}
      </span>
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
