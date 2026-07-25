import { apiAuthed } from "./api";
import type { Money } from "./teachers";

export interface TeacherProfile {
  id: number;
  full_name: string;
  market: string;
  gender: "MALE" | "FEMALE" | "";
  languages: string;
  bio_en: string;
  bio_ar: string;
  intro_video_url: string;
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

const post = (path: string, body: unknown) =>
  apiAuthed(path, { method: "POST", body: JSON.stringify(body) });

export const teacherSelf = {
  getProfile: () => apiAuthed<TeacherProfile>("/api/teacher/profile/"),
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

  listPrices: () => apiAuthed<PriceRequest[]>("/api/teacher/prices/"),
  requestPrice: (lesson_category: number, custom_student_price_minor: number) =>
    post("/api/teacher/prices/", { lesson_category, custom_student_price_minor }) as Promise<PriceRequest>,
  removePrice: (id: number) => apiAuthed(`/api/teacher/prices/${id}/`, { method: "DELETE" }),
};
