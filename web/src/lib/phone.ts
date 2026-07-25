const DIAL_CODES: Record<string, string> = { EG: "20", SA: "966" };

/** Normalize a phone to E.164 using the selected market for the country code.
 * Mirrors the backend `normalize_phone` so client and server agree. */
export function toE164(phone: string, market?: string): string {
  if (!phone) return phone;
  let cleaned = phone.trim().replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);
  if (cleaned.startsWith("+")) return cleaned;
  const dial = market ? DIAL_CODES[market.toUpperCase()] : undefined;
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  return dial ? `+${dial}${cleaned}` : `+${cleaned}`;
}
