import { apiAuthed } from "./api";
import type { Paginated } from "./teachers";
import type { LessonCategoryOption } from "./teacher-self";

export type BookingStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED"
  | "COMPLETED"
  | "DISPUTED"
  | "NO_SHOW";

export interface Booking {
  id: number;
  student_name: string;
  teacher_id: number;
  teacher_name: string;
  lesson_category: LessonCategoryOption;
  scheduled_start: string;
  duration_min: number;
  status: BookingStatus;
  meeting_provider: string;
  meeting_link: string;
  price_minor: number;
  price_display: string;
  currency: string;
  is_trial: boolean;
  cancel_reason: string;
  completed_at: string | null;
  created_at: string;
}

const post = (path: string, body: unknown = {}) =>
  apiAuthed<Booking>(path, { method: "POST", body: JSON.stringify(body) });

export function listBookings(
  status?: string,
  opts: { from?: string; to?: string; page_size?: number } = {},
): Promise<Paginated<Booking>> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.page_size) params.set("page_size", String(opts.page_size));
  const qs = params.toString();
  return apiAuthed<Paginated<Booking>>(`/api/bookings/${qs ? `?${qs}` : ""}`);
}

export const bookingActions = {
  confirm: (id: number, meeting_provider: string, meeting_link: string) =>
    post(`/api/bookings/${id}/confirm/`, { meeting_provider, meeting_link }),
  decline: (id: number) => post(`/api/bookings/${id}/decline/`),
  complete: (id: number) => post(`/api/bookings/${id}/complete/`),
  cancel: (id: number, reason: string) => post(`/api/bookings/${id}/cancel/`, { reason }),
  dispute: (id: number, reason: string) => post(`/api/bookings/${id}/dispute/`, { reason }),
  noShow: (id: number) => post(`/api/bookings/${id}/no-show/`),
  resolve: (id: number, complete: boolean) => post(`/api/bookings/${id}/resolve/`, { complete }),
};
