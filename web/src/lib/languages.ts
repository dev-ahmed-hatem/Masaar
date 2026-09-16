/** Teaching languages offered in profile/application pickers. `label` is the
 *  language's own name (used in pickers); `en`/`ar` are for read-only display. */
export const LANGUAGE_OPTIONS = [
  { value: "ar", label: "العربية", en: "Arabic", ar: "العربية" },
  { value: "en", label: "English", en: "English", ar: "الإنجليزية" },
];

/** Display name for a language code, falling back to the raw code. */
export function languageName(code: string, locale: string): string {
  const option = LANGUAGE_OPTIONS.find((o) => o.value === code);
  if (!option) return code;
  return locale === "ar" ? option.ar : option.en;
}
