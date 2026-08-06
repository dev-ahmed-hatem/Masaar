/**
 * Single source of truth for the operational country markets.
 *
 * Publicly the platform positions itself across "the Arab world", but only
 * these markets are live today (they drive the phone dial code, the account's
 * currency, and pricing). Add another Arab country here — plus a seeded
 * `markets.Market` row on the backend — to expand; every consumer (signup
 * country step, admin filters, nationality badges) picks it up automatically.
 */

export type MarketCode = "EG" | "SA";

export interface MarketOption {
  code: MarketCode;
  dial: string;
  flag: string;
  nameEn: string;
  nameAr: string;
}

export const MARKETS: MarketOption[] = [
  { code: "EG", dial: "+20", flag: "🇪🇬", nameEn: "Egypt", nameAr: "مصر" },
  { code: "SA", dial: "+966", flag: "🇸🇦", nameEn: "Saudi Arabia", nameAr: "السعودية" },
];

/** Validate the LOCAL part of a phone number for a market (before E.164).
 *  EG mobile: 01[0/1/2/5] + 8 digits. SA mobile: 05 + 8 digits. Leading 0
 *  optional (users may type with or without it). */
export const MARKET_PHONE_RE: Record<MarketCode, RegExp> = {
  EG: /^0?1[0125]\d{8}$/,
  SA: /^0?5\d{8}$/,
};

export function findMarket(code: string): MarketOption | undefined {
  return MARKETS.find((m) => m.code === code);
}

/** Localized country name for a market code (falls back to the raw code). */
export function marketLabel(code: string, locale: string): string {
  const m = findMarket(code);
  if (!m) return code;
  return locale === "ar" ? m.nameAr : m.nameEn;
}
