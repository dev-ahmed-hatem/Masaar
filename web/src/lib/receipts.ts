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

export function listReceipts(status?: string): Promise<Paginated<Receipt>> {
  const qs = status ? `?status=${status}` : "";
  return apiAuthed<Paginated<Receipt>>(`/api/receipts/${qs}`);
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
