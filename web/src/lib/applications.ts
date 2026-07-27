import { apiAuthed, apiPost } from "./api";
import type { Paginated } from "./teachers";

export interface ApplicationInput {
  full_name: string;
  phone: string;
  email?: string;
  market: string;
  bio: string;
  intro_video_url?: string;
}

export type ApplicationStatus =
  | "PENDING"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED";

export interface TeacherApplication {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  market: string;
  bio: string;
  intro_video_url: string;
  document: string | null;
  status: ApplicationStatus;
  review_notes: string;
  reviewed_by: string | null;
  created_profile_id: number | null;
  created_at: string;
}

/** Public "become a teacher" submission (no auth required). */
export function submitApplication(body: ApplicationInput): Promise<TeacherApplication> {
  return apiPost<TeacherApplication>("/api/teacher-applications/", body);
}

export function listApplications(
  status?: string,
): Promise<Paginated<TeacherApplication>> {
  const qs = status ? `?status=${status}` : "";
  return apiAuthed<Paginated<TeacherApplication>>(`/api/teacher-applications/${qs}`);
}

export function approveApplication(
  id: number,
): Promise<{ message: string; application: TeacherApplication }> {
  return apiAuthed(`/api/teacher-applications/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function rejectApplication(
  id: number,
  notes: string,
): Promise<TeacherApplication> {
  return apiAuthed(`/api/teacher-applications/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}
