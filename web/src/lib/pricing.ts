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
  is_active: boolean;
}

export interface CategoryInput {
  market: string;
  vertical: number;
  grade_level?: number | null;
  subject: number;
}

/** A moderator-set stage rule: minimum price + platform commission, per market. */
export interface StagePricingRuleAdmin {
  id: number;
  market: string;
  vertical: number;
  stage_name_en: string;
  stage_name_ar: string;
  min_price_minor: number;
  commission_pct: string; // DRF DecimalField serializes as a string, e.g. "15.00"
  currency: string;
  is_active: boolean;
}

export interface StageRuleInput {
  market: string;
  vertical: number;
  min_price_minor: number;
  commission_pct: number;
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
  // Lesson categories are taxonomy only (which subjects are bookable per market/stage/grade).
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

  // Stage pricing rules: minimum price + platform commission per (market, stage).
  listStageRules: (market?: string) =>
    apiAuthed<Paginated<StagePricingRuleAdmin>>(
      `/api/admin/stage-pricing/?page_size=100${market ? `&market=${market}` : ""}`,
    ),
  createStageRule: (body: StageRuleInput) =>
    apiAuthed<StagePricingRuleAdmin>("/api/admin/stage-pricing/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateStageRule: (id: number, patch: Partial<StageRuleInput> & { is_active?: boolean }) =>
    apiAuthed<StagePricingRuleAdmin>(`/api/admin/stage-pricing/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteStageRule: (id: number) =>
    apiAuthed<void>(`/api/admin/stage-pricing/${id}/`, { method: "DELETE" }),

  listVerticals: () => apiAuthed<Vertical[]>("/api/catalog/verticals/"),
  listGrades: (vertical?: number) =>
    apiAuthed<GradeLevel[]>(
      `/api/catalog/grade-levels/${vertical ? `?vertical=${vertical}` : ""}`,
    ),
  listSubjects: () => apiAuthed<Subject[]>("/api/catalog/subjects/"),
};
