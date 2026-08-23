import { apiAuthed, apiAuthedForm } from "./api";
import type { Certification, Education, Experience, Money } from "./teachers";

export interface TeacherProfile {
  id: number;
  full_name: string;
  market: string;
  photo_url: string | null;
  gender: "MALE" | "FEMALE" | "";
  languages: string;
  bio_en: string;
  bio_ar: string;
  intro_video_url: string;
  specialties: string[];
  education: Education[];
  work_experience: Experience[];
  certifications: Certification[];
  free_lessons_offered: number;
  rating_avg: string | number;
  rating_count: number;
  lessons_count: number;
  is_published: boolean;
}

export interface LessonCategoryOption {
  id: number;
  label: string;
  label_ar: string;
  student_price_minor: number;
  currency: string;
}

export interface EffectivePrice extends Money {
  is_custom: boolean;
}

export interface TeacherSubject {
  id: number;
  lesson_category: LessonCategoryOption;
  effective_price: EffectivePrice;
}

export interface AvailabilityRule {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface PriceRequest {
  id: number;
  lesson_category: LessonCategoryOption;
  custom_student_price_minor: number;
  is_approved: boolean;
}

export interface TeacherSpecialization {
  id: number;
  vertical: number;
  track: number | null;
  subject: number;
  stage_name_en: string;
  stage_name_ar: string;
  track_name_en: string | null;
  track_name_ar: string | null;
  subject_name_en: string;
  subject_name_ar: string;
}

export interface SpecializationInput {
  vertical: number;
  track?: number | null;
  subject: number;
}

export interface TeacherDashboard {
  profile: {
    full_name: string;
    is_published: boolean;
    rating_avg: number;
    rating_count: number;
    lessons_count: number;
  };
  pending_requests: number;
  upcoming_count: number;
  next_lesson: import("./bookings").Booking | null;
  earnings: { pending_minor: number; paid_minor: number; currency: string };
  unread_notifications: number;
  unread_messages: number;
}

const post = (path: string, body: unknown) =>
  apiAuthed(path, { method: "POST", body: JSON.stringify(body) });

export const teacherSelf = {
  dashboard: () => apiAuthed<TeacherDashboard>("/api/teacher/dashboard/"),
  getProfile: () => apiAuthed<TeacherProfile>("/api/teacher/profile/"),
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return apiAuthedForm<TeacherProfile>("/api/teacher/profile/photo/", form);
  },
  removePhoto: () =>
    apiAuthed<TeacherProfile>("/api/teacher/profile/photo/", { method: "DELETE" }),
  updateProfile: (patch: Partial<TeacherProfile>) =>
    apiAuthed<TeacherProfile>("/api/teacher/profile/", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  publish: () => post("/api/teacher/profile/publish/", {}) as Promise<TeacherProfile>,
  unpublish: () => post("/api/teacher/profile/unpublish/", {}) as Promise<TeacherProfile>,

  listCategories: () => apiAuthed<LessonCategoryOption[]>("/api/teacher/lesson-categories/"),

  listSubjects: () => apiAuthed<TeacherSubject[]>("/api/teacher/subjects/"),
  addSubject: (lesson_category: number) =>
    post("/api/teacher/subjects/", { lesson_category }) as Promise<TeacherSubject>,
  removeSubject: (id: number) => apiAuthed(`/api/teacher/subjects/${id}/`, { method: "DELETE" }),

  listAvailability: () => apiAuthed<AvailabilityRule[]>("/api/teacher/availability/"),
  addAvailability: (body: Omit<AvailabilityRule, "id">) =>
    post("/api/teacher/availability/", body) as Promise<AvailabilityRule>,
  removeAvailability: (id: number) =>
    apiAuthed(`/api/teacher/availability/${id}/`, { method: "DELETE" }),

  listSpecializations: () =>
    apiAuthed<TeacherSpecialization[]>("/api/teacher/specializations/"),
  addSpecialization: (body: SpecializationInput) =>
    post("/api/teacher/specializations/", body) as Promise<TeacherSpecialization>,
  removeSpecialization: (id: number) =>
    apiAuthed(`/api/teacher/specializations/${id}/`, { method: "DELETE" }),

  listPrices: () => apiAuthed<PriceRequest[]>("/api/teacher/prices/"),
  requestPrice: (lesson_category: number, custom_student_price_minor: number) =>
    post("/api/teacher/prices/", { lesson_category, custom_student_price_minor }) as Promise<PriceRequest>,
  removePrice: (id: number) => apiAuthed(`/api/teacher/prices/${id}/`, { method: "DELETE" }),
};
