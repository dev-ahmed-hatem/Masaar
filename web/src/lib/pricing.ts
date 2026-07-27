import { apiAuthed } from "./api";
import type { Paginated } from "./teachers";

export interface LessonCategoryAdmin {
  id: number;
  market: string;
  vertical: number;
  grade_level: number | null;
  subject: number;
  label: string;
  label_ar: string;
  student_price_minor: number;
  teacher_wage_minor: number;
  currency: string;
  is_active: boolean;
}

export interface CategoryInput {
  market: string;
  vertical: number;
  grade_level?: number | null;
  subject: number;
  student_price_minor: number;
  teacher_wage_minor: number;
}

export interface PriceRequestAdmin {
  id: number;
  teacher_id: number;
  teacher_name: string;
  market: string;
  label: string;
  default_price_minor: number;
  custom_student_price_minor: number;
  currency: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vertical {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
}

export interface GradeLevel {
  id: number;
  vertical: number;
  name_en: string;
  name_ar: string;
}

export interface Subject {
  id: number;
  name_en: string;
  name_ar: string;
}

export const pricingApi = {
  listCategories: (market?: string) =>
    apiAuthed<Paginated<LessonCategoryAdmin>>(
      `/api/admin/lesson-categories/?page_size=100${market ? `&market=${market}` : ""}`,
    ),
  createCategory: (body: CategoryInput) =>
    apiAuthed<LessonCategoryAdmin>("/api/admin/lesson-categories/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCategory: (id: number, patch: Partial<CategoryInput> & { is_active?: boolean }) =>
    apiAuthed<LessonCategoryAdmin>(`/api/admin/lesson-categories/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  listPriceRequests: (status: "pending" | "approved" = "pending") =>
    apiAuthed<Paginated<PriceRequestAdmin>>(`/api/price-requests/?status=${status}`),
  approvePriceRequest: (id: number) =>
    apiAuthed<PriceRequestAdmin>(`/api/price-requests/${id}/approve/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  rejectPriceRequest: (id: number, reason: string) =>
    apiAuthed<{ deleted: boolean }>(`/api/price-requests/${id}/reject/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  listVerticals: () => apiAuthed<Vertical[]>("/api/catalog/verticals/"),
  listGrades: (vertical?: number) =>
    apiAuthed<GradeLevel[]>(
      `/api/catalog/grade-levels/${vertical ? `?vertical=${vertical}` : ""}`,
    ),
  listSubjects: () => apiAuthed<Subject[]>("/api/catalog/subjects/"),
};
