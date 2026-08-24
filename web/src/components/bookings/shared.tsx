"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Tag } from "antd";

import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listBookings, type Booking, type BookingStatus } from "@/lib/bookings";

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

  const loadGroup = useCallback((group: BookingGroup, page: number) => {
    return listBookings(undefined, { group, page, page_size: LESSONS_PAGE_SIZE }).then((res) =>
      setGroups((prev) => ({ ...prev, [group]: { rows: res.results, total: res.count, page } })),
    );
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

  const setPage = useCallback(
    (group: BookingGroup, page: number) => {
      loadGroup(group, page).catch(() => {});
    },
    [loadGroup],
  );

  return { groups, loading, error, reload, setPage };
}

export const STATUS_COLORS: Record<BookingStatus, string> = {
  REQUESTED: "gold",
  CONFIRMED: "blue",
  COMPLETED: "green",
  DECLINED: "default",
  CANCELLED: "default",
  DISPUTED: "red",
  NO_SHOW: "volcano",
};

export function statusLabel(dict: Dict, status: BookingStatus): string {
  return dict[`status${status}` as keyof Dict] as string;
}

export function StatusTag({ dict, status }: { dict: Dict; status: BookingStatus }) {
  return (
    <Tag
      color={STATUS_COLORS[status]}
      bordered={false}
      style={{ borderRadius: 999, fontWeight: 600, paddingInline: 12 }}
    >
      {statusLabel(dict, status)}
    </Tag>
  );
}

export function formatWhen(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export function subjectLabel(booking: Booking, locale: string): string {
  return locale === "ar" ? booking.lesson_category.label_ar : booking.lesson_category.label;
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
    <div className="surface flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {subjectLabel(booking, locale)}
          </div>
          <div className="mt-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
            {who} · {formatWhen(booking.scheduled_start, locale)}
          </div>
        </div>
        <StatusTag dict={bookingsDict} status={booking.status} />
      </div>
      {(price || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {price ? (
            <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{price}</span>
          ) : (
            <span />
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}
