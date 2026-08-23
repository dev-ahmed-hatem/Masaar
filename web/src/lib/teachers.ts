import { apiAuthed } from "./api";

export interface Money {
  amount_minor: number;
  currency: string;
  display: string;
}

export interface SubjectSummary {
  id: number;
  name_en: string;
  name_ar: string;
}

export interface TeacherListItem {
  id: number;
  full_name: string;
  market: string;
  photo_url: string | null;
  gender: "MALE" | "FEMALE" | "";
  languages: string[];
  intro_video_url: string;
  bio_en: string;
  bio_ar: string;
  rating_avg: string | number;
  rating_count: number;
  lessons_count: number;
  free_lessons_offered: number;
  subjects: SubjectSummary[];
  from_price: Money | null;
}

export interface Offering {
  lesson_category_id: number;
  vertical: string;
  grade_level: string | null;
  subject: string;
  price: Money;
  is_custom_price: boolean;
}

export interface Availability {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface Review {
  rating: number;
  text: string;
  student_name: string;
  created_at: string;
}

export interface Education {
  degree: string;
  institution: string;
  start_year: string;
  end_year: string;
  description: string;
}

export interface Experience {
  title: string;
  organization: string;
  start_year: string;
  end_year: string;
  description: string;
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
  description: string;
}

export interface TeacherDetail extends TeacherListItem {
  bio_en: string;
  bio_ar: string;
  specialties: string[];
  education: Education[];
  work_experience: Experience[];
  certifications: Certification[];
  offerings: Offering[];
  availability: Availability[];
  reviews_summary: { rating_avg: string | number; rating_count: number };
  recent_reviews: Review[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TeacherQuery {
  market: string;
  subject?: number;
  gender?: string;
  min_rating?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export function listTeachers(q: TeacherQuery): Promise<Paginated<TeacherListItem>> {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      params.set(key, String(value));
    }
  });
  return apiAuthed<Paginated<TeacherListItem>>(`/api/teachers/?${params.toString()}`);
}

export function getTeacher(id: number): Promise<TeacherDetail> {
  return apiAuthed<TeacherDetail>(`/api/teachers/${id}/`);
}

export function listSubjects(): Promise<SubjectSummary[]> {
  return apiAuthed<SubjectSummary[]>(`/api/catalog/subjects/`);
}
