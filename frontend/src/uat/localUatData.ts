import legacyCatalog from "../../data/legacy-catalog.json" with { type: "json" };
import { CATEGORIES, type Category, type ItemSummary } from "../types/item.ts";
import type { JourneyPeriod, JourneyRoute, JourneyWaypoint } from "../types/journey.ts";

interface CatalogRecord {
  category: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  icon_slug?: string;
  start_year?: number;
  end_year?: number;
  quiz_questions?: unknown[];
  translations?: { lang: string; title: string }[];
}

const catalogRecords = legacyCatalog as CatalogRecord[];
const categorySet = new Set<string>(CATEGORIES);

function getCategory(value: string): Category {
  if (!categorySet.has(value)) {
    throw new Error(`Unsupported local UAT category: ${value}`);
  }
  return value as Category;
}

function getEnglishTitle(record: CatalogRecord): string {
  const translation = record.translations?.find((entry) => entry.lang === "en") ?? record.translations?.[0];
  if (!translation?.title) throw new Error("Local UAT catalog item is missing a title.");
  return translation.title;
}

export const LOCAL_UAT_ITEMS: ItemSummary[] = catalogRecords.map((record, index) => ({
  id: `local-uat-item-${index + 1}`,
  category: getCategory(record.category),
  latitude: record.latitude,
  longitude: record.longitude,
  ...(record.country_code ? { country_code: record.country_code } : {}),
  title: getEnglishTitle(record),
  icon_slug: record.icon_slug ?? record.category,
  ...(record.start_year !== undefined ? { start_year: record.start_year } : {}),
  ...(record.end_year !== undefined ? { end_year: record.end_year } : {}),
  has_quiz: Boolean(record.quiz_questions?.length),
  quiz_required: Boolean(record.quiz_questions?.length),
}));

const itemsByTitle = new Map(LOCAL_UAT_ITEMS.map((item) => [item.title, item]));

const JOURNEY_STOPS: { title: string; done_at: string }[] = [
  { title: "Banh Mi", done_at: "2026-09-24T08:00:00.000Z" },
  { title: "Angkor Wat", done_at: "2026-09-25T08:00:00.000Z" },
  { title: "Great Barrier Reef", done_at: "2026-09-26T08:00:00.000Z" },
  { title: "Eiffel Tower", done_at: "2026-09-27T08:00:00.000Z" },
  { title: "Sahara Desert", done_at: "2026-09-28T08:00:00.000Z" },
  { title: "Arepas", done_at: "2026-09-29T08:00:00.000Z" },
  { title: "African Elephant", done_at: "2026-09-30T08:00:00.000Z" },
];

const journeyWaypoints: JourneyWaypoint[] = JOURNEY_STOPS.map((stop) => {
  const item = itemsByTitle.get(stop.title);
  if (!item) throw new Error(`Local UAT journey item is missing: ${stop.title}`);
  return {
    kind: "item",
    item_id: item.id,
    title: item.title,
    category: item.category,
    latitude: item.latitude,
    longitude: item.longitude,
    done_at: stop.done_at,
  };
});

const PERIOD_COUNTS: Record<JourneyPeriod, number> = {
  today: 2,
  yesterday: 3,
  last3days: 5,
  last7days: journeyWaypoints.length,
};

export function getLocalUatJourney(period: JourneyPeriod): JourneyRoute {
  const waypoints = journeyWaypoints.slice(0, PERIOD_COUNTS[period]);
  return {
    origin: {
      latitude: 21.0285,
      longitude: 105.8542,
      title: "Home base · Hanoi",
    },
    waypoints,
    exploredCount: waypoints.length,
  };
}

export const LOCAL_UAT_JOURNEY_SOURCE = {
  items: LOCAL_UAT_ITEMS,
  loadJourney: async (period: JourneyPeriod): Promise<JourneyRoute> => getLocalUatJourney(period),
};

export const LOCAL_UAT_PROGRESS = {
  done_item_ids: journeyWaypoints.map((waypoint) => waypoint.item_id),
  wip_item_ids: [],
};

export function isLocalUatPath(pathname: string, isDev: boolean): boolean {
  return isDev && (pathname === "/uat" || pathname.startsWith("/uat/"));
}
