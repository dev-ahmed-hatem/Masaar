import { apiAuthed, apiPostForm } from "./api";
import type { StageCard, StageCardInput } from "./stage-cards";
import type { Certification, Education, Experience, Paginated } from "./teachers";

/** The full profile an applicant fills in on the public "become a teacher" form. */
export interface ApplicationInput {
  full_name: string;
  phone: string;
  email: string;
  market: string;
  gender: "MALE" | "FEMALE";
  languages: string; // comma-separated codes, e.g. "ar,en"
  bio: string; // English bio
  bio_ar?: string;
  intro_video_url: string;
  specialties?: string[];
  education?: Education[];
  work_experience?: Experience[];
  certifications?: Certification[];
  stages: StageCardInput[];
  photo?: File | null;
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
  currency: string;
  gender: "MALE" | "FEMALE" | "";
  languages: string[];
  bio: string;
  bio_ar: string;
  intro_video_url: string;
  photo: string | null;
  document: string | null;
  specialties: string[];
  education: Education[];
  work_experience: Experience[];
  certifications: Certification[];
  /** The submitted stage cards, resolved to catalog names (ids may be stale). */
  stages_display: Omit<StageCard, "id">[];
  status: ApplicationStatus;
  review_notes: string;
  reviewed_by: string | null;
  created_profile_id: number | null;
  created_at: string;
  updated_at: string;
}

const JSON_FIELDS = ["specialties", "education", "work_experience", "certifications", "stages"] as const;

/** Public "become a teacher" submission (no auth). Sent as multipart so the
 *  optional photo rides along; list/object fields are JSON-encoded strings. */
export function submitApplication(body: ApplicationInput): Promise<TeacherApplication> {
  const form = new FormData();
  form.set("full_name", body.full_name);
  form.set("phone", body.phone);
  form.set("market", body.market);
  form.set("bio", body.bio);
  form.set("email", body.email);
  form.set("gender", body.gender);
  form.set("languages", body.languages);
  form.set("intro_video_url", body.intro_video_url);
  if (body.bio_ar) form.set("bio_ar", body.bio_ar);
  for (const key of JSON_FIELDS) {
    form.set(key, JSON.stringify(body[key] ?? []));
  }
  if (body.photo) form.set("photo", body.photo);
  return apiPostForm<TeacherApplication>("/api/teacher-applications/", form);
}

export function listApplications(
  status?: string,
  page = 1,
  page_size = 20,
): Promise<Paginated<TeacherApplication>> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  qs.set("page", String(page));
  qs.set("page_size", String(page_size));
  return apiAuthed<Paginated<TeacherApplication>>(`/api/teacher-applications/?${qs}`);
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
