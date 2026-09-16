import { apiAuthed, apiAuthedForm } from "./api";
import type { StageCard, StageCardInput } from "./stage-cards";
import type { Certification, Education, Experience } from "./teachers";

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
  rating_avg: string | number;
  rating_count: number;
  lessons_count: number;
  is_published: boolean;
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

  // Stage cards: subjects, price, free trials and weekly hours per stage.
  listStages: () => apiAuthed<StageCard[]>("/api/teacher/stages/"),
  createStage: (body: StageCardInput) => post("/api/teacher/stages/", body) as Promise<StageCard>,
  updateStage: (id: number, body: Partial<StageCardInput>) =>
    apiAuthed<StageCard>(`/api/teacher/stages/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteStage: (id: number) => apiAuthed(`/api/teacher/stages/${id}/`, { method: "DELETE" }),
};
