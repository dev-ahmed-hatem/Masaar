import { apiAuthed } from "./api";
import type { Paginated } from "./teachers";

export interface NotificationItem {
  id: number;
  channel: "PUSH" | "WHATSAPP" | "EMAIL";
  event_type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "SENT" | "FAILED";
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationsApi = {
  list: (pageSize = 15) =>
    apiAuthed<Paginated<NotificationItem>>(`/api/notifications/?page_size=${pageSize}`),
  markRead: (ids?: number[]) =>
    apiAuthed<{ marked_read: number }>("/api/notifications/mark-read/", {
      method: "POST",
      body: JSON.stringify(ids ? { ids } : {}),
    }),
  unreadCount: () =>
    apiAuthed<{ unread_count: number }>("/api/notifications/unread-count/"),
};
