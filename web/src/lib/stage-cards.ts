import type { Money } from "./teachers";

/** A catalog row reference with both names (stage, branch/faculty, subject). */
export interface NamedRef {
  id: number;
  name_en: string;
  name_ar: string;
}

/** A recurring weekly window (weekday 0 = Monday), "HH:MM" local to the market. */
export interface WeeklyWindow {
  weekday: number;
  start_time: string;
  end_time: string;
}

/**
 * A teacher's "stage card": one stage (+ branch/faculty) with its subjects, and
 * the price, free trial lessons and weekly hours that apply to all of them.
 */
export interface StageCard {
  id: number;
  stage: NamedRef;
  track: NamedRef | null;
  subjects: NamedRef[];
  price: Money;
  free_lessons_offered: number;
  availability: WeeklyWindow[];
  /** Teacher self API only: the stage minimum and why the card isn't bookable yet. */
  min_price_minor?: number;
  incomplete?: ("subject" | "price" | "availability")[];
}

/** Write shape of a card (teacher self API and teacher applications). */
export interface StageCardInput {
  vertical: number;
  track: number | null;
  subjects: number[];
  price_minor: number;
  free_lessons_offered: number;
  availability: WeeklyWindow[];
}

export function refName(ref: NamedRef | null | undefined, locale: string): string {
  if (!ref) return "";
  return locale === "ar" ? ref.name_ar : ref.name_en;
}

/** "Secondary · Science" / "Primary". */
export function stageCardTitle(card: Pick<StageCard, "stage" | "track">, locale: string): string {
  return [refName(card.stage, locale), refName(card.track, locale)].filter(Boolean).join(" · ");
}

export function formatMoney(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`.trim();
}

export function toStageCardInput(card: StageCard): StageCardInput {
  return {
    vertical: card.stage.id,
    track: card.track?.id ?? null,
    subjects: card.subjects.map((s) => s.id),
    price_minor: card.price.amount_minor,
    free_lessons_offered: card.free_lessons_offered,
    availability: card.availability,
  };
}

/** Windows sorted by day then start time, for stable display. */
export function sortWindows(windows: WeeklyWindow[]): WeeklyWindow[] {
  return [...windows].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
  );
}
