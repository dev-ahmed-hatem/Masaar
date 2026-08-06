"use client";

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
