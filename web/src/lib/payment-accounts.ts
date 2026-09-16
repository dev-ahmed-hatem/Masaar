import { apiAuthed } from "./api";

/** A platform account students pay into, managed by moderators (/api/admin/). */
export interface PaymentAccountAdmin {
  id: number;
  market: string;
  kind: "BANK" | "WALLET";
  display_name: string;
  details: string;
  instructions: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentAccountInput = Pick<
  PaymentAccountAdmin,
  "market" | "kind" | "display_name" | "details" | "instructions" | "sort_order" | "is_active"
>;

const BASE = "/api/admin/payment-accounts/";

export const paymentAccountsApi = {
  list: (market?: string) =>
    apiAuthed<PaymentAccountAdmin[]>(`${BASE}${market ? `?market=${encodeURIComponent(market)}` : ""}`),
  create: (body: PaymentAccountInput) =>
    apiAuthed<PaymentAccountAdmin>(BASE, { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<PaymentAccountInput>) =>
    apiAuthed<PaymentAccountAdmin>(`${BASE}${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiAuthed<void>(`${BASE}${id}/`, { method: "DELETE" }),
};
