import { apiAuthed } from "./api";
import type { Paginated } from "./teachers";

/**
 * Whether a stage has an intermediate grouping (a Track) and what to call it.
 * BRANCH and FACULTY are translated here; GROUPED takes its name from the
 * stage's own `child_label_*`, so a moderator can add e.g. a "Curriculum" or
 * "Exam" grouping without a deploy.
 */
export type ChildKind = "NONE" | "BRANCH" | "FACULTY" | "GROUPED";

/** A display-only header over sibling stages (e.g. "International education"). */
export interface StageGroup {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  order: number;
}

export interface Stage {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  group: StageGroup | null;
  child_kind: ChildKind;
  child_label_en: string;
  child_label_ar: string;
  order: number;
  is_active: boolean;
}

/** One rendered section of the stage list: a header (or none) and its stages. */
export interface StageSection {
  group: StageGroup | null;
  stages: Stage[];
}

/**
 * Split the server-ordered stage list into sections, preserving order.
 *
 * The server keeps a group's stages contiguous, so this only has to open a new
 * section when the group changes. A non-contiguous group degrades gracefully
 * into two sections rather than reordering anything.
 */
export function groupStages(stages: Stage[]): StageSection[] {
  const sections: StageSection[] = [];
  for (const stage of stages) {
    const last = sections[sections.length - 1];
    if (last && (last.group?.id ?? null) === (stage.group?.id ?? null)) last.stages.push(stage);
    else sections.push({ group: stage.group, stages: [stage] });
  }
  return sections;
}

/** The i18n keys a caller needs for a stage's track field, per grouping kind. */
type TrackWords = { label: string; choose: string; all: string };

const TRACK_WORDS: Record<Exclude<ChildKind, "NONE" | "GROUPED">, TrackWords> = {
  BRANCH: { label: "branch", choose: "chooseBranch", all: "allBranches" },
  FACULTY: { label: "faculty", choose: "chooseFaculty", all: "allFaculties" },
};

/**
 * What this stage calls its Track, in the reader's language.
 *
 * A GROUPED stage names itself (moderator-authored); the others read from the
 * caller's dictionary. `dict` is the block holding the branch/faculty strings —
 * `browse` or `stageCards`, depending on the screen.
 */
export function trackWord(
  stage: Stage | undefined | null,
  // The i18n blocks hold arrays too (weekday names), so this stays loose and
  // reads through `str` rather than forcing every caller to narrow its dict.
  dict: Record<string, unknown>,
  locale: string,
  which: keyof TrackWords = "label",
): string {
  const str = (key: string) => (typeof dict[key] === "string" ? (dict[key] as string) : "");
  const fallback = () => str(TRACK_WORDS.BRANCH[which]);

  if (!stage || stage.child_kind === "NONE") return fallback();
  if (stage.child_kind === "GROUPED") {
    const name = locale === "ar" ? stage.child_label_ar : stage.child_label_en;
    if (!name) return fallback();
    // "Curriculum" -> "Choose a curriculum" / "All curricula" come from one
    // pattern, not a fresh translation per grouping a moderator invents.
    if (which === "choose") return (str("chooseTrackFor") || "{label}").replace("{label}", name);
    if (which === "all") return (str("allTracksFor") || "{label}").replace("{label}", name);
    return name;
  }
  return str(TRACK_WORDS[stage.child_kind][which]);
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

export interface LessonCategoryOption {
  id: number;
  label: string;
  label_ar: string;
}

/** Public per-stage minimum price + commission for a market. */
export interface StagePricing {
  id: number;
  vertical: number;
  stage_name_en: string;
  stage_name_ar: string;
  min_price_minor: number;
  commission_pct: string;
  currency: string;
}

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
  // Market-scoped pricing keys; public so the "become a teacher" form can offer
  // a subject picker without an authenticated market.
  listLessonCategories: (market: string) =>
    apiAuthed<LessonCategoryOption[]>(
      `/api/catalog/lesson-categories/?market=${encodeURIComponent(market)}`,
    ),
  listStagePricing: (market: string) =>
    apiAuthed<StagePricing[]>(
      `/api/catalog/stage-pricing/?market=${encodeURIComponent(market)}`,
    ),
};

// --- Moderator CRUD (/api/admin/) ------------------------------------------

export interface StageInput {
  code: string;
  name_en: string;
  name_ar: string;
  /** Written by id; read back nested as `Stage.group`. */
  group_id?: number | null;
  child_kind: ChildKind;
  child_label_en?: string;
  child_label_ar?: string;
  order?: number;
  is_active?: boolean;
}
export interface StageGroupInput {
  code: string;
  name_en: string;
  name_ar: string;
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

/** Drop the pagination envelope the moderator endpoints wrap their lists in. */
const page = async <T>(req: Promise<Paginated<T>>): Promise<T[]> => (await req).results;

const del = (path: string) => apiAuthed<void>(path, { method: "DELETE" });
const post = <T>(path: string, body: unknown) =>
  apiAuthed<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  apiAuthed<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export const catalogAdmin = {
  // Stage groups (display-only headers)
  listGroups: () => page(apiAuthed<Paginated<StageGroup>>("/api/admin/stage-groups/")),
  createGroup: (body: StageGroupInput) => post<StageGroup>("/api/admin/stage-groups/", body),
  updateGroup: (id: number, body: Partial<StageGroupInput>) =>
    patch<StageGroup>(`/api/admin/stage-groups/${id}/`, body),
  deleteGroup: (id: number) => del(`/api/admin/stage-groups/${id}/`),
  // Stages
  // The /api/admin/ viewsets are paginated; the public /api/catalog/ ones are
  // not. Unwrap here so every caller sees a plain array either way.
  listStages: () => page(apiAuthed<Paginated<Stage>>("/api/admin/stages/")),
  createStage: (body: StageInput) => post<Stage>("/api/admin/stages/", body),
  updateStage: (id: number, body: Partial<StageInput>) => patch<Stage>(`/api/admin/stages/${id}/`, body),
  deleteStage: (id: number) => del(`/api/admin/stages/${id}/`),
  // Tracks
  listTracks: (vertical?: number) =>
    page(apiAuthed<Paginated<Track>>(`/api/admin/tracks/${vertical ? `?vertical=${vertical}` : ""}`)),
  createTrack: (body: TrackInput) => post<Track>("/api/admin/tracks/", body),
  updateTrack: (id: number, body: Partial<TrackInput>) => patch<Track>(`/api/admin/tracks/${id}/`, body),
  deleteTrack: (id: number) => del(`/api/admin/tracks/${id}/`),
  // Subjects
  listSubjects: () => page(apiAuthed<Paginated<CatalogSubject>>("/api/admin/subjects/")),
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
    return page(apiAuthed<Paginated<StageSubject>>(`/api/admin/stage-subjects/${qs ? `?${qs}` : ""}`));
  },
  createAssignment: (body: StageSubjectInput) => post<StageSubject>("/api/admin/stage-subjects/", body),
  deleteAssignment: (id: number) => del(`/api/admin/stage-subjects/${id}/`),
};
