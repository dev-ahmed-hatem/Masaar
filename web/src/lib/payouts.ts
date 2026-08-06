import { apiAuthed } from "./api";
import type { Paginated } from "./teachers";

export type CycleStatus = "OPEN" | "PROCESSING" | "PAID";
export type ItemStatus = "PENDING" | "PAID";

export interface PayoutItem {
  id: number;
  teacher_id: number;
  teacher_name: string;
  amount_minor: number;
  amount_display: string;
  currency: string;
  lessons_count: number;
  status: ItemStatus;
  paid_at: string | null;
  reference: string;
}

export interface PayoutCycle {
  id: number;
  market: string;
  period_start: string;
  period_end: string;
  status: CycleStatus;
  items_count: number;
  total_minor: number;
  created_at: string;
}

export interface PayoutCycleDetail extends PayoutCycle {
  items: PayoutItem[];
}

export function listCycles(
  params: { market?: string; status?: string; page?: number; page_size?: number },
): Promise<Paginated<PayoutCycle>> {
  const qs = new URLSearchParams();
  if (params.market) qs.set("market", params.market);
  if (params.status) qs.set("status", params.status);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));
  return apiAuthed<Paginated<PayoutCycle>>(`/api/payout-cycles/?${qs}`);
}

export function getCycle(id: number): Promise<PayoutCycleDetail> {
  return apiAuthed<PayoutCycleDetail>(`/api/payout-cycles/${id}/`);
}

export function generateCycle(body: {
  market: string;
  period_start: string;
  period_end: string;
}): Promise<PayoutCycleDetail> {
  return apiAuthed(`/api/payout-cycles/`, { method: "POST", body: JSON.stringify(body) });
}

export function markItemPaid(id: number, reference: string): Promise<PayoutItem> {
  return apiAuthed(`/api/payout-items/${id}/mark-paid/`, {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
}

export function myPayouts(): Promise<PayoutItem[]> {
  return apiAuthed<PayoutItem[]>(`/api/my-payouts/`);
}
