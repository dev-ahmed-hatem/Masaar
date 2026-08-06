import { API_URL, apiAuthed } from "./api";
import type { Paginated } from "./teachers";

export interface ChatThread {
  id: number;
  teacher_id: number;
  teacher_name: string;
  student_id: number;
  student_name: string;
  last_message: { body: string; sender_id: number | null } | null;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_name: string;
  body: string;
  created_at: string;
}

/** Cursor-paginated page (newest-first; `next` walks older messages). */
export interface CursorPage<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Turn a fully-qualified DRF pagination URL into an apiAuthed path. */
function toPath(url: string): string {
  if (url.startsWith(API_URL)) return url.slice(API_URL.length);
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
}

export const chatApi = {
  threads: () => apiAuthed<Paginated<ChatThread>>("/api/chat/threads/"),
  /** Start (or fetch existing) 1:1 thread with a teacher by TeacherProfile id. */
  startThread: (teacherProfileId: number) =>
    apiAuthed<ChatThread>("/api/chat/threads/", {
      method: "POST",
      body: JSON.stringify({ teacher: teacherProfileId }),
    }),
  messages: (threadId: number) =>
    apiAuthed<CursorPage<ChatMessage>>(`/api/chat/threads/${threadId}/messages/`),
  messagesPage: (url: string) => apiAuthed<CursorPage<ChatMessage>>(toPath(url)),
  send: (threadId: number, body: string) =>
    apiAuthed<ChatMessage>(`/api/chat/threads/${threadId}/messages/`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  markRead: (threadId: number) =>
    apiAuthed<{ unread_count: number }>(`/api/chat/threads/${threadId}/read/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  unreadCount: () => apiAuthed<{ unread_count: number }>("/api/chat/unread-count/"),
};
