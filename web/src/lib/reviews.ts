import { apiAuthed } from "./api";
import type { Paginated } from "./teachers";

export interface Review {
  id: number;
  teacher_id: number;
  teacher_name: string;
  student_name: string;
  rating: number;
  text: string;
  is_published: boolean;
  created_at: string;
}

export interface CreateReviewInput {
  booking: number;
  rating: number;
  text?: string;
}

/** Leave a review for a COMPLETED booking (one per booking, student-only). */
export function createReview(input: CreateReviewInput): Promise<Review> {
  return apiAuthed<Review>(`/api/reviews/`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listReviews(
  params: { teacher?: number; published?: string; page?: number; page_size?: number },
): Promise<Paginated<Review>> {
  const qs = new URLSearchParams();
  if (params.teacher) qs.set("teacher", String(params.teacher));
  if (params.published) qs.set("published", params.published);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));
  return apiAuthed<Paginated<Review>>(`/api/reviews/?${qs}`);
}

/** The current student's own review history (published or not). */
export function listMyReviews(): Promise<Paginated<Review>> {
  return apiAuthed<Paginated<Review>>(`/api/reviews/?mine=true`);
}

export function unpublishReview(id: number): Promise<Review> {
  return apiAuthed(`/api/reviews/${id}/unpublish/`, { method: "POST", body: JSON.stringify({}) });
}

export function republishReview(id: number): Promise<Review> {
  return apiAuthed(`/api/reviews/${id}/republish/`, { method: "POST", body: JSON.stringify({}) });
}
