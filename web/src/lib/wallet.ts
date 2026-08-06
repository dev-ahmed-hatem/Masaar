import { apiAuthed, apiAuthedForm } from "./api";
import type { Paginated } from "./teachers";

export interface Wallet {
  currency: string;
  available_minor: number;
  reserved_minor: number;
  available_display: string;
}

export type LedgerKind =
  | "TOPUP"
  | "RESERVE"
  | "CAPTURE"
  | "REFUND"
  | "PACKAGE_GRANT"
  | "ADJUSTMENT";

export interface LedgerEntry {
  id: number;
  kind: LedgerKind;
  amount_minor: number;
  balance_after_minor: number;
  booking_id: number | null;
  note: string;
  created_at: string;
}

export interface PaymentAccount {
  id: number;
  kind: "BANK" | "WALLET";
  display_name: string;
  details: string;
  instructions: string;
  sort_order: number;
}

export type ReceiptStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Receipt {
  id: number;
  user_name: string;
  user_phone: string;
  market: string;
  amount_minor: number;
  amount_display: string;
  currency: string;
  method: "BANK" | "WALLET";
  reference: string;
  image: string | null;
  purpose: "TOPUP" | "BOOKING" | "PACKAGE";
  status: ReceiptStatus;
  reject_reason: string;
  reviewed_by: string | null;
  created_at: string;
}

export interface Package {
  id: number;
  name: string;
  credits: number;
  price_minor: number;
  price_display: string;
  currency: string;
}

export interface PackagePurchase {
  id: number;
  package_name: string;
  status: "PENDING" | "GRANTED" | "REJECTED";
  credits_granted: number;
  receipt_status: ReceiptStatus;
  created_at: string;
}

export function getWallet(): Promise<{ wallet: Wallet; ledger: LedgerEntry[] }> {
  return apiAuthed(`/api/wallet/`);
}

export function listPaymentAccounts(): Promise<PaymentAccount[]> {
  return apiAuthed(`/api/payment-accounts/`);
}

export function listReceipts(): Promise<Paginated<Receipt> | Receipt[]> {
  return apiAuthed(`/api/receipts/`);
}

/** Upload a manual-payment receipt (multipart, optional image). */
export function createReceipt(form: FormData): Promise<Receipt> {
  return apiAuthedForm<Receipt>(`/api/receipts/`, form);
}

export function listPackages(): Promise<Package[]> {
  return apiAuthed(`/api/packages/`);
}

export function purchasePackage(id: number, form: FormData): Promise<PackagePurchase> {
  return apiAuthedForm<PackagePurchase>(`/api/packages/${id}/purchase/`, form);
}

export function listPackagePurchases(): Promise<Paginated<PackagePurchase> | PackagePurchase[]> {
  return apiAuthed(`/api/package-purchases/`);
}
