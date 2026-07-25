"use client";

import { Tag } from "antd";

import type { Dictionary } from "@/i18n/dictionaries";
import type { Booking, BookingStatus } from "@/lib/bookings";

type Dict = Dictionary["bookings"];

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
  return <Tag color={STATUS_COLORS[status]}>{statusLabel(dict, status)}</Tag>;
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
