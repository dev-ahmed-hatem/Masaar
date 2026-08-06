import { apiAuthed } from "./api";
import type { AuthUser } from "./auth";

export interface StudentProfile {
  date_of_birth: string | null;
  grade_level: number | null;
}

/** Update safe account fields (name / email / locale). Returns the full user. */
export function updateMe(
  patch: Partial<Pick<AuthUser, "full_name" | "email" | "locale">>,
): Promise<AuthUser> {
  return apiAuthed<AuthUser>("/api/auth/me/", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function getStudentProfile(): Promise<StudentProfile> {
  return apiAuthed<StudentProfile>("/api/auth/me/profile/");
}

export function updateStudentProfile(patch: Partial<StudentProfile>): Promise<StudentProfile> {
  return apiAuthed<StudentProfile>("/api/auth/me/profile/", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
