"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listBookings, type Booking, type BookingStatus } from "@/lib/bookings";
import { useRefreshOnFocus } from "@/lib/use-refresh-on-focus";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Dict = Dictionary["bookings"];

export const LESSONS_PAGE_SIZE = 20;
export type BookingGroup = "requested" | "upcoming" | "past";
interface GroupState {
  rows: Booking[];
  total: number;
  page: number;
}
const EMPTY: GroupState = { rows: [], total: 0, page: 1 };

/**
 * Server-paginated bookings grouped into Requested / Upcoming / Past tabs.
 * Each group is fetched with the backend `?group=` filter and its own page,
 * so lists never silently drop rows past the first page. Shared by the student
 * and teacher lesson views for identical behaviour.
 */
export function useGroupedBookings(errorMsg: string) {
  const [groups, setGroups] = useState<Record<BookingGroup, GroupState>>({
    requested: EMPTY,
    upcoming: EMPTY,
    past: EMPTY,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Current page per group, so a background refresh reloads what's on screen.
  const pagesRef = useRef<Record<BookingGroup, number>>({ requested: 1, upcoming: 1, past: 1 });

  const loadGroup = useCallback((group: BookingGroup, page: number) => {
    return listBookings(undefined, { group, page, page_size: LESSONS_PAGE_SIZE }).then((res) => {
      pagesRef.current[group] = page;
      setGroups((prev) => ({ ...prev, [group]: { rows: res.results, total: res.count, page } }));
    });
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadGroup("requested", 1), loadGroup("upcoming", 1), loadGroup("past", 1)])
      .catch((e) => setError(e instanceof ApiError ? e.message : errorMsg))
      .finally(() => setLoading(false));
  }, [loadGroup, errorMsg]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Silently refresh (no spinner) on tab focus / poll, so a reschedule or cancel
  // made by the other participant surfaces without a manual reload.
  const silentReload = useCallback(() => {
    const pages = pagesRef.current;
    Promise.all([
      loadGroup("requested", pages.requested),
      loadGroup("upcoming", pages.upcoming),
      loadGroup("past", pages.past),
    ]).catch(() => {});
  }, [loadGroup]);
  useRefreshOnFocus(silentReload);

  const setPage = useCallback(
    (group: BookingGroup, page: number) => {
      loadGroup(group, page).catch(() => {});
    },
    [loadGroup],
  );

  return { groups, loading, error, reload, setPage };
}

/**
 * Lesson status -> badge tone. REQUESTED is the only amber here: it is the one
 * status that is waiting on somebody, so it should catch the eye.
 */
export const STATUS_TONES: Record<BookingStatus, NonNullable<BadgeProps["variant"]>> = {
  REQUESTED: "warning",
  CONFIRMED: "brand",
  COMPLETED: "success",
  DECLINED: "neutral",
  CANCELLED: "neutral",
  DISPUTED: "error",
  NO_SHOW: "error",
};

export function statusLabel(dict: Dict, status: BookingStatus): string {
  return dict[`status${status}` as keyof Dict] as string;
}

export function StatusTag({ dict, status }: { dict: Dict; status: BookingStatus }) {
  return <Badge variant={STATUS_TONES[status]} size="sm">{statusLabel(dict, status)}</Badge>;
}

export function formatWhen(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export function subjectLabel(booking: Booking, locale: string): string {
  return locale === "ar" ? booking.lesson.label_ar : booking.lesson.label;
}

export const PROVIDERS = [
  { value: "ZOOM", label: "Zoom" },
  { value: "MEET", label: "Google Meet" },
  { value: "TEAMS", label: "Microsoft Teams" },
  { value: "CUSTOM", label: "Custom link" },
];

/** Mobile-first lesson card — replaces the admin table row on both sides. */
export function LessonCard({
  booking,
  bookingsDict,
  locale,
  who,
  price,
  actions,
}: {
  booking: Booking;
  bookingsDict: Dict;
  locale: string;
  /** The other party ("with {teacher}" for students, the student for teachers). */
  who: string;
  /** Prebuilt price/trial label (caller decides trial vs price_display). */
  price?: string;
  actions?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div dir="auto" className="t-body font-semibold text-ink">
            {subjectLabel(booking, locale)}
          </div>
          {/* <bdi> per value, not dir="auto" on the line: a Latin teacher name
              next to an Arabic-formatted date is two directions in one run,
              and without isolation the date's digits and separators scatter. */}
          <div className="mt-0.5 t-caption text-ink-muted">
            <bdi>{who}</bdi> · <bdi>{formatWhen(booking.scheduled_start, locale)}</bdi>
          </div>
        </div>
        <StatusTag dict={bookingsDict} status={booking.status} />
      </div>
      {price || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          {price ? (
            <span className="t-body font-bold text-ink">{price}</span>
          ) : (
            <span />
          )}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </Card>
  );
}
