import { AppError } from "./errors.js";

export const MAX_FLASHCARD_DECK_SIZE = 15;
export const MAX_FLASHCARD_CANDIDATE_ITEMS = 100;
export const MAX_FLASHCARDS_PER_ITEM_LANGUAGE = 32;

export type FlashcardThemeType = "item" | "country" | "continent" | "era" | "category";
export type FlashcardRating = "got_it" | "review_again";
export type EraId = "dino" | "ancient" | "medieval" | "olden" | "today";

export interface FlashcardRecord {
  id: string;
  item_id: string;
  item_title: string;
  lang: string;
  front: string;
  back: string;
  media_hint?: string;
  sort_order: number;
  source_type: string;
}

export interface FlashcardCandidateItem {
  id: string;
  category: string;
  country_code?: string | null;
  start_year?: number | null;
  title: string;
  has_quiz: boolean;
}

export interface FlashcardThemeDescriptor {
  theme_type: FlashcardThemeType;
  theme_value: string;
  title: string;
  description: string;
  min_cards: number;
}

export interface FlashcardStudyResponse {
  flashcard_id: string;
  rating: FlashcardRating;
}

const LEGACY_COUNTRY_INFO: Record<string, readonly [name: string, continent: string]> = {
  AE: ["United Arab Emirates", "Asia"], AF: ["Afghanistan", "Asia"], AL: ["Albania", "Europe"],
  DZ: ["Algeria", "Africa"], AR: ["Argentina", "South America"], AU: ["Australia", "Oceania"],
  AT: ["Austria", "Europe"], BD: ["Bangladesh", "Asia"], BE: ["Belgium", "Europe"],
  BO: ["Bolivia", "South America"], BR: ["Brazil", "South America"], BZ: ["Belize", "North America"],
  CA: ["Canada", "North America"], CL: ["Chile", "South America"], CN: ["China", "Asia"],
  CO: ["Colombia", "South America"], HR: ["Croatia", "Europe"], CZ: ["Czech Republic", "Europe"],
  DK: ["Denmark", "Europe"], EC: ["Ecuador", "South America"], EG: ["Egypt", "Africa"],
  ET: ["Ethiopia", "Africa"], FI: ["Finland", "Europe"], FR: ["France", "Europe"],
  DE: ["Germany", "Europe"], GH: ["Ghana", "Africa"], GR: ["Greece", "Europe"],
  GT: ["Guatemala", "North America"], GY: ["Guyana", "South America"], HT: ["Haiti", "North America"],
  HU: ["Hungary", "Europe"], IN: ["India", "Asia"], ID: ["Indonesia", "Asia"],
  IR: ["Iran", "Asia"], IS: ["Iceland", "Europe"], IQ: ["Iraq", "Asia"], IE: ["Ireland", "Europe"],
  IL: ["Israel", "Asia"], IT: ["Italy", "Europe"], JP: ["Japan", "Asia"], JO: ["Jordan", "Asia"],
  KH: ["Cambodia", "Asia"], KZ: ["Kazakhstan", "Asia"], KE: ["Kenya", "Africa"],
  KR: ["South Korea", "Asia"], MV: ["Maldives", "Asia"], MY: ["Malaysia", "Asia"],
  MX: ["Mexico", "North America"], MA: ["Morocco", "Africa"], MM: ["Myanmar", "Asia"],
  NP: ["Nepal", "Asia"], NL: ["Netherlands", "Europe"], NZ: ["New Zealand", "Oceania"],
  NA: ["Namibia", "Africa"], NG: ["Nigeria", "Africa"], NO: ["Norway", "Europe"],
  PK: ["Pakistan", "Asia"], PE: ["Peru", "South America"], PH: ["Philippines", "Asia"],
  PL: ["Poland", "Europe"], PT: ["Portugal", "Europe"], RO: ["Romania", "Europe"],
  RU: ["Russia", "Europe"], SA: ["Saudi Arabia", "Asia"], SN: ["Senegal", "Africa"],
  SG: ["Singapore", "Asia"], ZA: ["South Africa", "Africa"], ES: ["Spain", "Europe"],
  LK: ["Sri Lanka", "Asia"], SE: ["Sweden", "Europe"], CH: ["Switzerland", "Europe"],
  SY: ["Syria", "Asia"], TW: ["Taiwan", "Asia"], TH: ["Thailand", "Asia"],
  TZ: ["Tanzania", "Africa"], TR: ["Turkey", "Asia"], UA: ["Ukraine", "Europe"],
  GB: ["United Kingdom", "Europe"], US: ["United States", "North America"],
  UZ: ["Uzbekistan", "Asia"], VE: ["Venezuela", "South America"], VN: ["Vietnam", "Asia"],
  YE: ["Yemen", "Asia"], ZW: ["Zimbabwe", "Africa"],
};

const CATALOG_COUNTRY_INFO: Record<string, readonly [name: string, continent: string]> = {
  AG: ["Antigua and Barbuda", "North America"], AM: ["Armenia", "Asia"], AO: ["Angola", "Africa"],
  AQ: ["Antarctica", "Antarctica"], AZ: ["Azerbaijan", "Asia"], BA: ["Bosnia and Herzegovina", "Europe"],
  BB: ["Barbados", "North America"], BG: ["Bulgaria", "Europe"], BH: ["Bahrain", "Asia"],
  BM: ["Bermuda", "North America"], BN: ["Brunei", "Asia"], BT: ["Bhutan", "Asia"],
  BW: ["Botswana", "Africa"], BY: ["Belarus", "Europe"], CD: ["Democratic Republic of the Congo", "Africa"],
  CI: ["Côte d'Ivoire", "Africa"], CK: ["Cook Islands", "Oceania"], CM: ["Cameroon", "Africa"],
  CR: ["Costa Rica", "North America"], CU: ["Cuba", "North America"], CV: ["Cabo Verde", "Africa"],
  CY: ["Cyprus", "Asia"], DM: ["Dominica", "North America"], DO: ["Dominican Republic", "North America"],
  EE: ["Estonia", "Europe"], ER: ["Eritrea", "Africa"], FK: ["Falkland Islands", "South America"],
  GA: ["Gabon", "Africa"], GD: ["Grenada", "North America"], GE: ["Georgia", "Asia"],
  GI: ["Gibraltar", "Europe"], GL: ["Greenland", "North America"], GM: ["Gambia", "Africa"],
  GN: ["Guinea", "Africa"], GP: ["Guadeloupe", "North America"], HK: ["Hong Kong", "Asia"],
  HN: ["Honduras", "North America"], JM: ["Jamaica", "North America"], KG: ["Kyrgyzstan", "Asia"], KP: ["North Korea", "Asia"],
  KW: ["Kuwait", "Asia"], LA: ["Laos", "Asia"], LB: ["Lebanon", "Asia"],
  LC: ["Saint Lucia", "North America"], LI: ["Liechtenstein", "Europe"], LS: ["Lesotho", "Africa"],
  LT: ["Lithuania", "Europe"], LU: ["Luxembourg", "Europe"], LY: ["Libya", "Africa"],
  MC: ["Monaco", "Europe"], MD: ["Moldova", "Europe"], ME: ["Montenegro", "Europe"],
  MG: ["Madagascar", "Africa"], MH: ["Marshall Islands", "Oceania"], MK: ["North Macedonia", "Europe"],
  ML: ["Mali", "Africa"], MN: ["Mongolia", "Asia"], MQ: ["Martinique", "North America"],
  MR: ["Mauritania", "Africa"], MS: ["Montserrat", "North America"], MT: ["Malta", "Europe"],
  MU: ["Mauritius", "Africa"], MW: ["Malawi", "Africa"], MZ: ["Mozambique", "Africa"],
  NE: ["Niger", "Africa"], NI: ["Nicaragua", "North America"], NR: ["Nauru", "Oceania"],
  NU: ["Niue", "Oceania"], OM: ["Oman", "Asia"], PF: ["French Polynesia", "Oceania"],
  PG: ["Papua New Guinea", "Oceania"], PR: ["Puerto Rico", "North America"], PS: ["Palestine", "Asia"],
  PY: ["Paraguay", "South America"], QA: ["Qatar", "Asia"], RE: ["Réunion", "Africa"],
  RS: ["Serbia", "Europe"], SB: ["Solomon Islands", "Oceania"], SC: ["Seychelles", "Africa"],
  SD: ["Sudan", "Africa"], SI: ["Slovenia", "Europe"], SK: ["Slovakia", "Europe"],
  SL: ["Sierra Leone", "Africa"], SO: ["Somalia", "Africa"], SR: ["Suriname", "South America"],
  SS: ["South Sudan", "Africa"], ST: ["São Tomé and Príncipe", "Africa"], SV: ["El Salvador", "North America"],
  SZ: ["Eswatini", "Africa"], TD: ["Chad", "Africa"], TG: ["Togo", "Africa"],
  TJ: ["Tajikistan", "Asia"], TL: ["Timor-Leste", "Asia"], TM: ["Turkmenistan", "Asia"],
  TN: ["Tunisia", "Africa"], TT: ["Trinidad and Tobago", "North America"], TV: ["Tuvalu", "Oceania"],
  UG: ["Uganda", "Africa"], UY: ["Uruguay", "South America"], VU: ["Vanuatu", "Oceania"],
  XK: ["Kosovo", "Europe"],
};

const COUNTRY_INFO = { ...LEGACY_COUNTRY_INFO, ...CATALOG_COUNTRY_INFO };

const ERA_LABELS: Record<EraId, string> = {
  dino: "Dino Age",
  ancient: "Long Ago",
  medieval: "Middle Ages",
  olden: "Olden Times",
  today: "Today",
};

export function countryName(code: string): string {
  const normalized = code.trim().toUpperCase();
  return COUNTRY_INFO[normalized]?.[0] ?? normalized;
}

export function continentForCountry(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  return COUNTRY_INFO[normalized]?.[1] ?? "Unknown";
}

export function countryCodesForContinent(continent: string): string[] {
  return Object.entries(COUNTRY_INFO)
    .filter(([, value]) => value[1] === continent)
    .map(([code]) => code);
}

export function knownCountryCodes(): string[] {
  return Object.keys(COUNTRY_INFO);
}

export function eraForYear(year: number | null | undefined): EraId | null {
  if (year === null || year === undefined) return null;
  if (year <= -10_000) return "dino";
  if (year <= 500) return "ancient";
  if (year <= 1500) return "medieval";
  if (year <= 1900) return "olden";
  return "today";
}

export function buildThemeDescriptors(item: FlashcardCandidateItem): FlashcardThemeDescriptor[] {
  const output: FlashcardThemeDescriptor[] = [{
    theme_type: "item",
    theme_value: item.id,
    title: "Study This Item",
    description: "Quick cards for this place, food, song, or story.",
    min_cards: 1,
  }];
  const country = item.country_code?.trim().toUpperCase();
  if (country) {
    output.push({
      theme_type: "country",
      theme_value: country,
      title: `More From ${countryName(country)}`,
      description: "Mix cards from nearby items in the same country.",
      min_cards: 6,
    });
    const continent = continentForCountry(country);
    if (continent) output.push({
      theme_type: "continent",
      theme_value: continent,
      title: `Explore ${continent}`,
      description: "Travel wider with cards from the same continent.",
      min_cards: 6,
    });
  }
  const era = eraForYear(item.start_year);
  if (era) output.push({
    theme_type: "era",
    theme_value: era,
    title: `Travel ${ERA_LABELS[era]}`,
    description: "Study cards from the same time period.",
    min_cards: 6,
  });
  const categoryTitle = item.category.charAt(0).toUpperCase() + item.category.slice(1);
  output.push({
    theme_type: "category",
    theme_value: item.category,
    title: `More In ${categoryTitle}`,
    description: "Stay on theme with related cards from this category.",
    min_cards: 6,
  });
  return output;
}

export function themeMatchesItem(
  item: Pick<FlashcardCandidateItem, "id" | "category" | "country_code" | "start_year">,
  themeType: FlashcardThemeType,
  themeValue: string,
): boolean {
  if (themeType === "item") return item.id === themeValue;
  if (themeType === "country") return item.country_code?.trim().toUpperCase() === themeValue.trim().toUpperCase();
  if (themeType === "continent") return continentForCountry(item.country_code) === themeValue;
  if (themeType === "era") return eraForYear(item.start_year) === themeValue;
  return item.category === themeValue;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededSort<T>(values: readonly T[], seed: string, getKey: (value: T) => string): T[] {
  return [...values].sort((left, right) => {
    const leftKey = getKey(left);
    const rightKey = getKey(right);
    const difference = hashString(`${seed}:${leftKey}`) - hashString(`${seed}:${rightKey}`);
    return difference || leftKey.localeCompare(rightKey);
  });
}

export function preferredFlashcardLanguage<T extends { lang: string }>(
  values: readonly T[],
  requestedLanguage: string,
): T[] {
  const exact = values.filter((value) => value.lang === requestedLanguage);
  return exact.length ? exact : values.filter((value) => value.lang === "en");
}

export function buildFlashcardDeck(
  profileId: string,
  focusItemId: string,
  themeType: FlashcardThemeType,
  themeValue: string,
  candidateItems: readonly FlashcardCandidateItem[],
  cardsByItem: ReadonlyMap<string, readonly FlashcardRecord[]>,
): FlashcardRecord[] {
  if (themeType === "item") return [...(cardsByItem.get(focusItemId) ?? [])].slice(0, MAX_FLASHCARD_DECK_SIZE);
  const orderedItems = [...candidateItems].sort((left, right) => {
    if (left.id === focusItemId && right.id !== focusItemId) return -1;
    if (right.id === focusItemId && left.id !== focusItemId) return 1;
    if (left.has_quiz !== right.has_quiz) return left.has_quiz ? -1 : 1;
    return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
  });
  const seed = `${profileId}:${themeType}:${themeValue}`;
  const shuffled = new Map(orderedItems.map((item) => [
    item.id,
    seededSort(cardsByItem.get(item.id) ?? [], `${seed}:${item.id}`, (value) => value.id),
  ]));
  const selected: FlashcardRecord[] = [];
  for (let round = 0; round < 2 && selected.length < MAX_FLASHCARD_DECK_SIZE; round += 1) {
    for (const item of orderedItems) {
      const value = shuffled.get(item.id)?.[round];
      if (value) selected.push(value);
      if (selected.length >= MAX_FLASHCARD_DECK_SIZE) break;
    }
  }
  if (selected.length < MAX_FLASHCARD_DECK_SIZE) {
    for (const item of orderedItems) {
      for (const value of (shuffled.get(item.id) ?? []).slice(2)) {
        selected.push(value);
        if (selected.length >= MAX_FLASHCARD_DECK_SIZE) break;
      }
      if (selected.length >= MAX_FLASHCARD_DECK_SIZE) break;
    }
  }
  return selected;
}

export function assertCanonicalDeckMembership(
  viewedFlashcardIds: readonly string[],
  canonicalDeck: readonly Pick<FlashcardRecord, "id">[],
): void {
  const canonicalIds = new Set(canonicalDeck.map((card) => card.id));
  if (viewedFlashcardIds.some((id) => !canonicalIds.has(id))) {
    throw new AppError(422, "INVALID_FLASHCARD_SESSION", "Viewed flashcards must belong to the canonical deck.");
  }
}

export function deriveStudySession(input: {
  viewed_flashcard_ids: readonly string[];
  responses: readonly FlashcardStudyResponse[];
  started_at: string;
}, now = new Date()): {
  cards_shown: number;
  got_it_count: number;
  review_again_count: number;
  started_at: Date;
  completed_at: Date;
} {
  const viewed = new Set(input.viewed_flashcard_ids);
  if (viewed.size !== input.viewed_flashcard_ids.length) {
    throw new AppError(422, "INVALID_FLASHCARD_SESSION", "Viewed flashcard IDs must be unique.");
  }
  const responseIds = new Set<string>();
  for (const response of input.responses) {
    if (responseIds.has(response.flashcard_id)) {
      throw new AppError(422, "INVALID_FLASHCARD_SESSION", "Flashcard responses must be unique.");
    }
    if (!viewed.has(response.flashcard_id)) {
      throw new AppError(422, "INVALID_FLASHCARD_SESSION", "Responses must refer to viewed flashcards.");
    }
    responseIds.add(response.flashcard_id);
  }
  const isIsoTimestamp = input.started_at.length <= 40
    && /T/.test(input.started_at)
    && /(?:Z|[+-]\d{2}:\d{2})$/.test(input.started_at);
  const startedAt = new Date(input.started_at);
  if (!isIsoTimestamp || !Number.isFinite(startedAt.getTime())) {
    throw new AppError(422, "INVALID_FLASHCARD_SESSION", "started_at must be a valid ISO timestamp.");
  }
  if (startedAt.getTime() > now.getTime()) {
    throw new AppError(422, "INVALID_FLASHCARD_SESSION", "started_at cannot be in the future.");
  }
  if (now.getTime() - startedAt.getTime() > 24 * 60 * 60 * 1000) {
    throw new AppError(422, "INVALID_FLASHCARD_SESSION", "started_at cannot be older than 24 hours.");
  }
  return {
    cards_shown: viewed.size,
    got_it_count: input.responses.filter((value) => value.rating === "got_it").length,
    review_again_count: input.responses.filter((value) => value.rating === "review_again").length,
    started_at: startedAt,
    completed_at: now,
  };
}
