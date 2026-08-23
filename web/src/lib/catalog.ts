import { apiAuthed } from "./api";

export type ChildKind = "NONE" | "BRANCH" | "FACULTY";

export interface Stage {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  child_kind: ChildKind;
  order: number;
  is_active: boolean;
}

export interface Track {
  id: number;
  vertical: number;
  name_en: string;
  name_ar: string;
  order: number;
  is_active: boolean;
}

export interface CatalogSubject {
  id: number;
  name_en: string;
  name_ar: string;
  is_active: boolean;
}

export interface StageSubject {
  id: number;
  vertical: number;
  track: number | null;
  subject: number;
  subject_name_en: string;
  subject_name_ar: string;
  order: number;
  is_active?: boolean;
}

/** Localized name helper for any catalog row with name_en/name_ar. */
export function catalogName(
  row: { name_en: string; name_ar: string },
  locale: string,
): string {
  return locale === "ar" ? row.name_ar : row.name_en;
}

// --- Legacy exports (grade levels; used by the student profile) -------------

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

// --- Public reads (drive the student filters + teacher/moderator pickers) ---

export const catalog = {
  listStages: () => apiAuthed<Stage[]>("/api/catalog/verticals/"),
  listTracks: (vertical?: number) =>
    apiAuthed<Track[]>(`/api/catalog/tracks/${vertical ? `?vertical=${vertical}` : ""}`),
  listStageSubjects: (vertical?: number, track?: number | null) => {
    const params = new URLSearchParams();
    if (vertical) params.set("vertical", String(vertical));
    if (track) params.set("track", String(track));
    const qs = params.toString();
    return apiAuthed<StageSubject[]>(`/api/catalog/stage-subjects/${qs ? `?${qs}` : ""}`);
  },
};

// --- Moderator CRUD (/api/admin/) ------------------------------------------

export interface StageInput {
  code: string;
  name_en: string;
  name_ar: string;
  child_kind: ChildKind;
  order?: number;
  is_active?: boolean;
}
export interface TrackInput {
  vertical: number;
  name_en: string;
  name_ar: string;
  order?: number;
  is_active?: boolean;
}
export interface SubjectInput {
  name_en: string;
  name_ar: string;
  is_active?: boolean;
}
export interface StageSubjectInput {
  vertical: number;
  track?: number | null;
  subject: number;
  order?: number;
  is_active?: boolean;
}

const del = (path: string) => apiAuthed<void>(path, { method: "DELETE" });
const post = <T>(path: string, body: unknown) =>
  apiAuthed<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  apiAuthed<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export const catalogAdmin = {
  // Stages
  listStages: () => apiAuthed<Stage[]>("/api/admin/stages/"),
  createStage: (body: StageInput) => post<Stage>("/api/admin/stages/", body),
  updateStage: (id: number, body: Partial<StageInput>) => patch<Stage>(`/api/admin/stages/${id}/`, body),
  deleteStage: (id: number) => del(`/api/admin/stages/${id}/`),
  // Tracks
  listTracks: (vertical?: number) =>
    apiAuthed<Track[]>(`/api/admin/tracks/${vertical ? `?vertical=${vertical}` : ""}`),
  createTrack: (body: TrackInput) => post<Track>("/api/admin/tracks/", body),
  updateTrack: (id: number, body: Partial<TrackInput>) => patch<Track>(`/api/admin/tracks/${id}/`, body),
  deleteTrack: (id: number) => del(`/api/admin/tracks/${id}/`),
  // Subjects
  listSubjects: () => apiAuthed<CatalogSubject[]>("/api/admin/subjects/"),
  createSubject: (body: SubjectInput) => post<CatalogSubject>("/api/admin/subjects/", body),
  updateSubject: (id: number, body: Partial<SubjectInput>) =>
    patch<CatalogSubject>(`/api/admin/subjects/${id}/`, body),
  deleteSubject: (id: number) => del(`/api/admin/subjects/${id}/`),
  // Assignments (stage/track ↔ subject)
  listAssignments: (vertical?: number, track?: number | null) => {
    const params = new URLSearchParams();
    if (vertical) params.set("vertical", String(vertical));
    if (track) params.set("track", String(track));
    const qs = params.toString();
    return apiAuthed<StageSubject[]>(`/api/admin/stage-subjects/${qs ? `?${qs}` : ""}`);
  },
  createAssignment: (body: StageSubjectInput) => post<StageSubject>("/api/admin/stage-subjects/", body),
  deleteAssignment: (id: number) => del(`/api/admin/stage-subjects/${id}/`),
};
