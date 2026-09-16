"use client";

import { useEffect, useState } from "react";

import { apiAuthed } from "./api";

/**
 * The Arab League countries the platform can operate in. Mirrors
 * `api/apps/markets/countries.py` (a `Market` row exists for each); which ones
 * are live comes from `GET /api/markets/` (moderators deactivate a market in the
 * Django admin to hide it). Each entry drives the dial code, flag, localized
 * name and the local mobile-number check.
 */

export type MarketCode = string;

export interface MarketOption {
  code: MarketCode;
  dial: string;
  nameEn: string;
  nameAr: string;
  currency: string;
  timezone: string;
  /** Local mobile number (national part, leading 0 optional). Loose by design. */
  mobile: RegExp;
}

export const MARKETS: MarketOption[] = [
  { code: "DZ", dial: "+213", nameEn: "Algeria", nameAr: "الجزائر", currency: "DZD", timezone: "Africa/Algiers", mobile: /^0?[567]\d{8}$/ },
  { code: "BH", dial: "+973", nameEn: "Bahrain", nameAr: "البحرين", currency: "BHD", timezone: "Asia/Bahrain", mobile: /^[36]\d{7}$/ },
  { code: "KM", dial: "+269", nameEn: "Comoros", nameAr: "جزر القمر", currency: "KMF", timezone: "Indian/Comoro", mobile: /^[34]\d{6}$/ },
  { code: "DJ", dial: "+253", nameEn: "Djibouti", nameAr: "جيبوتي", currency: "DJF", timezone: "Africa/Djibouti", mobile: /^77\d{6}$/ },
  { code: "EG", dial: "+20", nameEn: "Egypt", nameAr: "مصر", currency: "EGP", timezone: "Africa/Cairo", mobile: /^0?1[0125]\d{8}$/ },
  { code: "IQ", dial: "+964", nameEn: "Iraq", nameAr: "العراق", currency: "IQD", timezone: "Asia/Baghdad", mobile: /^0?7\d{9}$/ },
  { code: "JO", dial: "+962", nameEn: "Jordan", nameAr: "الأردن", currency: "JOD", timezone: "Asia/Amman", mobile: /^0?7[789]\d{7}$/ },
  { code: "KW", dial: "+965", nameEn: "Kuwait", nameAr: "الكويت", currency: "KWD", timezone: "Asia/Kuwait", mobile: /^[4569]\d{7}$/ },
  { code: "LB", dial: "+961", nameEn: "Lebanon", nameAr: "لبنان", currency: "LBP", timezone: "Asia/Beirut", mobile: /^0?(3\d{6}|(7[0169]|81)\d{6})$/ },
  { code: "LY", dial: "+218", nameEn: "Libya", nameAr: "ليبيا", currency: "LYD", timezone: "Africa/Tripoli", mobile: /^0?9[1-6]\d{7}$/ },
  { code: "MR", dial: "+222", nameEn: "Mauritania", nameAr: "موريتانيا", currency: "MRU", timezone: "Africa/Nouakchott", mobile: /^[234]\d{7}$/ },
  { code: "MA", dial: "+212", nameEn: "Morocco", nameAr: "المغرب", currency: "MAD", timezone: "Africa/Casablanca", mobile: /^0?[67]\d{8}$/ },
  { code: "OM", dial: "+968", nameEn: "Oman", nameAr: "عُمان", currency: "OMR", timezone: "Asia/Muscat", mobile: /^[79]\d{7}$/ },
  { code: "PS", dial: "+970", nameEn: "Palestine", nameAr: "فلسطين", currency: "ILS", timezone: "Asia/Gaza", mobile: /^0?5[69]\d{7}$/ },
  { code: "QA", dial: "+974", nameEn: "Qatar", nameAr: "قطر", currency: "QAR", timezone: "Asia/Qatar", mobile: /^[3567]\d{7}$/ },
  { code: "SA", dial: "+966", nameEn: "Saudi Arabia", nameAr: "السعودية", currency: "SAR", timezone: "Asia/Riyadh", mobile: /^0?5\d{8}$/ },
  { code: "SO", dial: "+252", nameEn: "Somalia", nameAr: "الصومال", currency: "SOS", timezone: "Africa/Mogadishu", mobile: /^0?[67]\d{7,8}$/ },
  { code: "SD", dial: "+249", nameEn: "Sudan", nameAr: "السودان", currency: "SDG", timezone: "Africa/Khartoum", mobile: /^0?[19]\d{8}$/ },
  { code: "SY", dial: "+963", nameEn: "Syria", nameAr: "سوريا", currency: "SYP", timezone: "Asia/Damascus", mobile: /^0?9\d{8}$/ },
  { code: "TN", dial: "+216", nameEn: "Tunisia", nameAr: "تونس", currency: "TND", timezone: "Africa/Tunis", mobile: /^[2459]\d{7}$/ },
  { code: "AE", dial: "+971", nameEn: "United Arab Emirates", nameAr: "الإمارات", currency: "AED", timezone: "Asia/Dubai", mobile: /^0?5\d{8}$/ },
  { code: "YE", dial: "+967", nameEn: "Yemen", nameAr: "اليمن", currency: "YER", timezone: "Asia/Aden", mobile: /^0?7\d{8}$/ },
];

export function findMarket(code: string | null | undefined): MarketOption | undefined {
  return MARKETS.find((m) => m.code === code);
}

/** Localized country name for a market code (falls back to the raw code). */
export function marketLabel(code: string, locale: string): string {
  const m = findMarket(code);
  if (!m) return code;
  return locale === "ar" ? m.nameAr : m.nameEn;
}

/** Whether a local phone number looks like a mobile number in that market. */
export function isValidLocalMobile(code: string, phone: string): boolean {
  const m = findMarket(code);
  if (!m) return true;
  return m.mobile.test(String(phone).replace(/[\s\-()]/g, ""));
}

// --- Active markets (from the API) ------------------------------------------

let activeCodes: Promise<Set<string>> | null = null;

function loadActiveCodes(): Promise<Set<string>> {
  if (!activeCodes) {
    activeCodes = apiAuthed<{ code: string }[]>("/api/markets/")
      .then((rows) => new Set(rows.map((r) => r.code)))
      .catch(() => {
        activeCodes = null; // retry next time; meanwhile offer every country
        return new Set(MARKETS.map((m) => m.code));
      });
  }
  return activeCodes;
}

/** The live markets, alphabetical in the viewer's language (all while loading). */
export function useMarkets(locale: string): MarketOption[] {
  const [codes, setCodes] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    loadActiveCodes().then((c) => alive && setCodes(c));
    return () => {
      alive = false;
    };
  }, []);
  const collator = new Intl.Collator(locale === "ar" ? "ar" : "en");
  return MARKETS.filter((m) => !codes || codes.has(m.code)).sort((a, b) =>
    collator.compare(locale === "ar" ? a.nameAr : a.nameEn, locale === "ar" ? b.nameAr : b.nameEn),
  );
}

// --- Remembered / guessed country ---------------------------------------------

const COUNTRY_KEY = "wisal.country";

/** The viewer's likely country: last one they picked, else their device timezone, else Egypt. */
export function guessMarket(): MarketCode {
  if (typeof window === "undefined") return "EG";
  try {
    const saved = localStorage.getItem(COUNTRY_KEY);
    if (saved && findMarket(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = MARKETS.find((m) => m.timezone === tz);
    if (match) return match.code;
  } catch {
    /* no Intl timezone */
  }
  return "EG";
}

export function rememberMarket(code: MarketCode): void {
  try {
    localStorage.setItem(COUNTRY_KEY, code);
  } catch {
    /* storage unavailable */
  }
}
