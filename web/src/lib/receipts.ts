import { apiAuthed } from "./api";
import type { Paginated } from "./teachers";

export type ReceiptStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Receipt {
  id: number;
  user_name: string;
  user_phone: string;
  market: string;
  amount_minor: number;
  amount_display: string;
  currency: string;
  method: string;
  reference: string;
  image: string | null;
  purpose: string;
  status: ReceiptStatus;
  reject_reason: string;
  reviewed_by: string | null;
  created_at: string;
}

export function listReceipts(status?: string, page = 1, page_size = 20): Promise<Paginated<Receipt>> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  qs.set("page", String(page));
  qs.set("page_size", String(page_size));
  return apiAuthed<Paginated<Receipt>>(`/api/receipts/?${qs}`);
}

export function approveReceipt(id: number): Promise<Receipt> {
  return apiAuthed(`/api/receipts/${id}/approve/`, { method: "POST", body: JSON.stringify({}) });
}

export function rejectReceipt(id: number, reason: string): Promise<Receipt> {
  return apiAuthed(`/api/receipts/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
