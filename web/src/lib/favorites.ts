import { apiAuthed } from "./api";
import type { TeacherListItem } from "./teachers";

/** The student's saved teachers (plain list, newest first). */
export function listFavorites(): Promise<TeacherListItem[]> {
  return apiAuthed<TeacherListItem[]>("/api/favorites/");
}

export function addFavorite(teacherId: number): Promise<unknown> {
  return apiAuthed("/api/favorites/", {
    method: "POST",
    body: JSON.stringify({ teacher: teacherId }),
  });
}

export function removeFavorite(teacherId: number): Promise<unknown> {
  return apiAuthed(`/api/favorites/${teacherId}/`, { method: "DELETE" });
}
