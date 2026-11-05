import type {
  ItemDetailRecord,
  ItemSummaryRecord,
  ProfileRecord,
} from "../contracts/db.js";

export type DbDate = Date | string | null | undefined;

export interface ProfileMappingRow {
  id: string;
  name: string;
  emoji: string;
  color: string;
  publicId: string;
  nativeCountryCode: string | null;
  nativeCity: string | null;
  avatarType: string | null;
  avatarUrl: string | null;
  avatarFrame: string | null;
  tourCompletedAt?: Date | string | null;
  createdAt: Date | string;
  totalDone: number | string | null;
  badgeCount: number | string | null;
}

export interface ItemSummaryMappingRow {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  iconSlug: string | null;
  startYear: number | null;
  endYear: number | null;
  quizRequired: boolean | number | string;
  hasQuiz: boolean | number | string;
}

export interface ItemDetailMappingRow {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  iconSlug: string | null;
  hasQuiz: boolean | number | string;
  quizRequired: boolean | number | string;
  startYear: number | null;
  endYear: number | null;
  recipe: string | null;
  locationDesc: string | null;
  funFacts: unknown;
  audioUrls: unknown;
  youtubeUrl: string | null;
  trailerUrl: string | null;
  characters: unknown;
  timePrecision: string | null;
  releasedDate: string | null;
  richFields: unknown;
  franchiseId: string | null;
}

export interface TranslationMappingRow {
  lang: string;
  title: string;
  description: string | null;
  history: string | null;
}

export interface MediaMappingRow {
  id: string;
  mediaType: string;
  label: string | null;
  filename: string;
  lang: string | null;
  sortOrder: number;
}

export interface SiblingMappingRow {
  id: string;
  title: string;
}

function dateString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: boolean | number | string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return value === "1" || value.toLowerCase() === "true";
}

/** Decode JSONB values and legacy text JSON without allowing parse failures to escape. */
export function safeStoredJson(value: unknown, fallback: unknown): unknown {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

export function boundedLimit(value: number | string | undefined, fallback: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : Number(value ?? Number.NaN);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), maximum);
}

export function profileFromRow(row: ProfileMappingRow): ProfileRecord {
  const createdAt = dateString(row.createdAt);
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    public_id: row.publicId,
    ...(row.nativeCountryCode ? { native_country_code: row.nativeCountryCode } : {}),
    ...(row.nativeCity ? { native_city: row.nativeCity } : {}),
    ...(row.avatarType ? { avatar_type: row.avatarType } : {}),
    ...(row.avatarUrl ? { avatar_url: row.avatarUrl } : {}),
    ...(row.avatarFrame ? { avatar_frame: row.avatarFrame } : {}),
    tour_completed_at: row.tourCompletedAt ? dateString(row.tourCompletedAt) : null,
    created_at: createdAt,
    total_done: numberValue(row.totalDone),
    badge_count: numberValue(row.badgeCount),
  };
}

export function itemSummaryFromRow(row: ItemSummaryMappingRow): ItemSummaryRecord {
  return {
    id: row.id,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    ...(row.countryCode ? { country_code: row.countryCode } : {}),
    title: "Untitled",
    icon_slug: row.iconSlug ?? "",
    ...(row.startYear !== null ? { start_year: row.startYear } : {}),
    ...(row.endYear !== null ? { end_year: row.endYear } : {}),
    has_quiz: booleanValue(row.hasQuiz),
    quiz_required: booleanValue(row.quizRequired) && booleanValue(row.hasQuiz),
  };
}

export function itemDetailFromRows(
  row: ItemDetailMappingRow,
  translations: TranslationMappingRow[],
  media: MediaMappingRow[],
  siblings: SiblingMappingRow[],
  requestedLanguage: string,
): ItemDetailRecord {
  const translation = translations.find((value) => value.lang === requestedLanguage)
    ?? translations.find((value) => value.lang === "en")
    ?? translations[0];
  const funFacts = safeStoredJson(row.funFacts, undefined);
  const audioUrls = safeStoredJson(row.audioUrls, undefined);
  const characters = safeStoredJson(row.characters, undefined);
  const richFields = safeStoredJson(row.richFields, undefined);

  return {
    id: row.id,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    ...(row.countryCode ? { country_code: row.countryCode } : {}),
    title: translation?.title ?? "Untitled",
    icon_slug: row.iconSlug ?? "",
    has_quiz: booleanValue(row.hasQuiz),
    ...(translation
      ? {
          translation: {
            lang: translation.lang,
            title: translation.title,
            ...(translation.description ? { description: translation.description } : {}),
            ...(translation.history ? { history: translation.history } : {}),
          },
        }
      : {}),
    media: media.map((value) => ({
      id: value.id,
      media_type: value.mediaType,
      ...(value.label ? { label: value.label } : {}),
      filename: value.filename,
      url: mediaUrl(value.filename),
    })),
    available_languages: [...new Set(translations.map((value) => value.lang))].sort(),
    ...(row.recipe ? { recipe: row.recipe } : {}),
    ...(row.locationDesc ? { location_desc: row.locationDesc } : {}),
    ...(funFacts !== undefined ? { fun_facts: funFacts } : {}),
    ...(audioUrls !== undefined ? { audio_urls: audioUrls } : {}),
    ...(row.youtubeUrl ? { youtube_url: row.youtubeUrl } : {}),
    ...(row.trailerUrl ? { trailer_url: row.trailerUrl } : {}),
    ...(characters !== undefined ? { characters } : {}),
    ...(row.startYear !== null ? { start_year: row.startYear } : {}),
    ...(row.endYear !== null ? { end_year: row.endYear } : {}),
    ...(row.timePrecision ? { time_precision: row.timePrecision } : {}),
    ...(row.releasedDate ? { released_date: row.releasedDate } : {}),
    ...(richFields !== undefined ? { rich_fields: richFields } : {}),
    ...(row.franchiseId ? { franchise_id: row.franchiseId } : {}),
    ...(siblings.length ? { franchise_siblings: siblings } : {}),
    quiz_required: booleanValue(row.quizRequired) && booleanValue(row.hasQuiz),
  };
}

export function mediaUrl(filename: string): string {
  return /^https:\/\//i.test(filename) ? filename : `/media/${filename}`;
}
