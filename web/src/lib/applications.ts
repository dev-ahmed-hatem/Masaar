import { apiAuthed, apiPostForm } from "./api";
import type { Certification, Education, Experience, Paginated } from "./teachers";

export interface SpecializationInput {
  vertical: number;
  track: number | null;
  subject: number;
}

export interface AvailabilityInput {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface StagePriceInput {
  vertical: number;
  price_minor: number;
}

/** The full profile an applicant fills in on the public "become a teacher" form. */
export interface ApplicationInput {
  full_name: string;
  phone: string;
  email?: string;
  market: string;
  gender?: "MALE" | "FEMALE" | "";
  languages?: string; // comma-separated codes, e.g. "ar,en"
  bio: string; // English bio
  bio_ar?: string;
  intro_video_url?: string;
  free_lessons_offered?: number;
  specialties?: string[];
  education?: Education[];
  work_experience?: Experience[];
  certifications?: Certification[];
  subjects?: number[]; // lesson-category ids
  specializations?: SpecializationInput[];
  availability?: AvailabilityInput[];
  stage_prices?: StagePriceInput[];
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
  gender: "MALE" | "FEMALE" | "";
  languages: string;
  bio: string;
  bio_ar: string;
  intro_video_url: string;
  photo: string | null;
  document: string | null;
  free_lessons_offered: number;
  specialties: string[];
  education: Education[];
  work_experience: Experience[];
  certifications: Certification[];
  // Resolved, human-readable labels for the catalog-linked teaching setup.
  subjects_display: string[];
  specializations_display: string[];
  availability_display: string[];
  stage_prices_display: string[];
  status: ApplicationStatus;
  review_notes: string;
  reviewed_by: string | null;
  created_profile_id: number | null;
  created_at: string;
}

const JSON_FIELDS = [
  "specialties",
  "education",
  "work_experience",
  "certifications",
  "subjects",
  "specializations",
  "availability",
  "stage_prices",
] as const;

/** Public "become a teacher" submission (no auth). Sent as multipart so the
 *  optional photo rides along; list/object fields are JSON-encoded strings. */
export function submitApplication(body: ApplicationInput): Promise<TeacherApplication> {
  const form = new FormData();
  form.set("full_name", body.full_name);
  form.set("phone", body.phone);
  form.set("market", body.market);
  form.set("bio", body.bio);
  if (body.email) form.set("email", body.email);
  if (body.gender) form.set("gender", body.gender);
  if (body.languages) form.set("languages", body.languages);
  if (body.bio_ar) form.set("bio_ar", body.bio_ar);
  if (body.intro_video_url) form.set("intro_video_url", body.intro_video_url);
  form.set("free_lessons_offered", String(body.free_lessons_offered ?? 0));
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
