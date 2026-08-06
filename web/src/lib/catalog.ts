import { apiAuthed } from "./api";

export interface Vertical {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  order: number;
}

export interface GradeLevel {
  id: number;
  vertical: number;
  name_en: string;
  name_ar: string;
  order: number;
}

export function listVerticals(): Promise<Vertical[]> {
  return apiAuthed<Vertical[]>("/api/catalog/verticals/");
}

export function listGradeLevels(vertical?: number): Promise<GradeLevel[]> {
  return apiAuthed<GradeLevel[]>(
    `/api/catalog/grade-levels/${vertical ? `?vertical=${vertical}` : ""}`,
  );
}
