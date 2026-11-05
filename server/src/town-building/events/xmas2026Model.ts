export const XMAS_EVENT_ID = 'xmas';
export const XMAS_EDITION = '2026-v1';
export const MAX_SNOW_SCULPTURES = 100;

export interface XmasState {
  year: string;
}

export const XMAS_SCULPTURE_IDS = [
  'snow-snowman',
  'snow-rabbit',
  'snow-owl',
  'snow-penguin',
  'snow-fox',
  'snow-lamb',
  'snow-duckling',
  'snow-bear',
  'snow-tree',
  'snow-angel',
] as const;

export type XmasSculptureId = typeof XMAS_SCULPTURE_IDS[number];
export type SnowSculptureId = XmasSculptureId;

export const isSnowSculpture = (id: string): id is XmasSculptureId =>
  (XMAS_SCULPTURE_IDS as readonly string[]).includes(id);

/**
 * Valid civil date check.
 */
export function isValidCivilDate(localDate?: string): boolean {
  if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return false;
  const date = new Date(`${localDate}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === localDate;
}

/**
 * Occurrence starting year for a given civil date in the Xmas window.
 * Dec 20..31 of Y belongs to Y.
 * Jan 1..6 of Y+1 belongs to Y.
 */
export function xmasStartingYear(localDate: string): number {
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  return month === 1 ? year - 1 : year;
}

/**
 * Checks if localDate is within Dec 20 .. Jan 6 inclusive on a valid civil date.
 */
export function isXmasOpen(localDate?: string): boolean {
  if (!isValidCivilDate(localDate)) return false;
  const month = Number(localDate!.slice(5, 7));
  const day = Number(localDate!.slice(8, 10));
  return (month === 12 && day >= 20 && day <= 31) || (month === 1 && day >= 1 && day <= 6);
}

/**
 * Timed-event host occurrence resolver.
 * Live home-city clock only; unknown clocks and previews never start it.
 */
export function xmasOccurrence(weather: Readonly<{ localDate?: string; timeOfDay?: string | null; weatherSource?: string }>): string | undefined {
  if (!weather.timeOfDay || !weather.localDate || weather.weatherSource === 'preview') return undefined;
  if (!isXmasOpen(weather.localDate)) return undefined;
  return String(xmasStartingYear(weather.localDate));
}
