import { coreRequest } from "./core.ts";
import { BADGE_NAMES } from "../lib/badge_config.ts";
import { isAvatarFrameId } from "../lib/avatarFrames.ts";
import { getCountryName, getContinent } from "../lib/countries.ts";
import type { AvatarFrameId } from "../lib/avatarFrames.ts";
import { useFamilyStore } from "../stores/familyStore.ts";
import type { ItemSummary } from "../types/item.ts";
import type { AchievementItem, BadgeInfo, ProfileLessonEntry, ProfileWithStats, RecentActivityEntry } from "../types/profile.ts";
import type { JourneyPeriod, JourneyRoute, JourneyWaypoint } from "../types/journey.ts";

interface Completion {
  item_id: string;
  category: string;
  done_at: string;
}

interface VisibleActivity {
  item_id: string;
  family_id: string;
  family_name: string;
  profile_id: string;
  profile_name: string;
  profile_emoji: string;
  profile_color: string;
  avatar_type?: "default" | "custom" | null;
  avatar_url?: string | null;
  avatar_frame?: AvatarFrameId | null;
  item_category: string;
  completed_at: string;
}

export async function fetchBadges(profileId: string): Promise<BadgeInfo[]> {
  const rows = await coreRequest<BadgeInfo[]>(`/api/v1/profiles/${encodeURIComponent(profileId)}/badges`);
  return rows.map((badge) => ({
    ...badge,
    name: BADGE_NAMES[badge.badge_key]?.name ?? badge.name,
    description: BADGE_NAMES[badge.badge_key]?.description ?? badge.description,
  }));
}

function completions(profileId: string): Promise<Completion[]> {
  return coreRequest<Completion[]>(`/api/v1/profiles/${encodeURIComponent(profileId)}/completions`);
}

export async function fetchAchievements(profileId: string, items: ItemSummary[]): Promise<AchievementItem[]> {
  const rows = await completions(profileId);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return rows.flatMap((row) => {
    const item = itemMap.get(row.item_id);
    if (!item) return [];
    return [{
      item_id: row.item_id, title: item.title, category: row.category,
      country_code: item.country_code, country_name: getCountryName(item.country_code),
      continent: getContinent(item.country_code), completed_at: row.done_at,
    }];
  });
}

export async function fetchProfileLessons(profileId: string, items: ItemSummary[]): Promise<ProfileLessonEntry[]> {
  const rows = await completions(profileId);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return rows.flatMap((row) => {
    const item = itemMap.get(row.item_id);
    if (!item) return [];
    return [{
      item_id: row.item_id, title: item.title, category: item.category,
      country_code: item.country_code, completed_at: row.done_at,
      quiz_required: item.quiz_required,
    }];
  });
}

export async function fetchRecentActivity(limit = 10, items: ItemSummary[]): Promise<RecentActivityEntry[]> {
  const familyId = useFamilyStore.getState().familyId;
  const rows = await coreRequest<VisibleActivity[]>(`/api/v1/activity/recent?limit=${Math.min(Math.max(limit, 1), 50)}`);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return rows.flatMap((row) => {
    const item = itemMap.get(row.item_id);
    if (!item) return [];
    return [{
      family_id: row.family_id, family_name: row.family_name,
      profile_id: row.profile_id, profile_name: row.profile_name,
      profile_emoji: row.profile_emoji, profile_color: row.profile_color,
      ...(row.avatar_type ? { avatar_type: row.avatar_type } : {}),
      ...(row.avatar_url ? { avatar_url: row.avatar_url } : {}),
      ...(isAvatarFrameId(row.avatar_frame) ? { avatar_frame: row.avatar_frame } : {}),
      item_id: row.item_id, item_title: item.title, item_category: row.item_category,
      country_name: getCountryName(item.country_code), continent: getContinent(item.country_code),
      completed_at: row.completed_at, is_own_family: row.family_id === familyId,
    }];
  });
}

const homeCoordinateCache = new Map<string, { latitude: number; longitude: number }>();

async function geocodeHomePlace(cityInput: string | null, countryInput: string | null) {
  const city = cityInput?.trim();
  const countryCode = countryInput?.toUpperCase() ?? null;
  if (!city || !countryCode) return null;
  const key = `${city}::${countryCode}`;
  const cached = homeCoordinateCache.get(key);
  if (cached) return cached;
  try {
    const coordinate = await coreRequest<{ latitude: number; longitude: number } | null>(
      `/api/v1/geocode/home?city=${encodeURIComponent(city)}&country=${encodeURIComponent(countryCode)}`,
    );
    if (coordinate && Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude)) {
      homeCoordinateCache.set(key, coordinate);
      return coordinate;
    }
  } catch { /* In-app location fallback remains available. */ }
  return null;
}

export async function fetchJourney(profileId: string, period: JourneyPeriod, items: ItemSummary[]): Promise<JourneyRoute> {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  const since = new Date(midnight);
  let until: Date | null = null;
  if (period === "yesterday") {
    since.setUTCDate(since.getUTCDate() - 1);
    until = midnight;
  } else if (period === "last3days") since.setUTCDate(since.getUTCDate() - 3);
  else if (period === "last7days") since.setUTCDate(since.getUTCDate() - 7);

  const [rows, profile] = await Promise.all([
    completions(profileId),
    coreRequest<ProfileWithStats>(`/api/v1/profiles/${encodeURIComponent(profileId)}`),
  ]);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const waypoints: JourneyWaypoint[] = rows
    .filter((row) => {
      const date = new Date(row.done_at);
      return date >= since && (!until || date < until);
    })
    .reverse()
    .flatMap((row) => {
      const item = itemMap.get(row.item_id);
      if (!item) return [];
      return [{
        kind: "item" as const, item_id: row.item_id, title: item.title,
        category: item.category, latitude: item.latitude, longitude: item.longitude, done_at: row.done_at,
      }];
    });
  const countryCode = profile.native_country_code?.toUpperCase() ?? null;
  const city = profile.native_city?.trim() || null;
  const countryItems = countryCode ? items.filter((item) => item.country_code?.toUpperCase() === countryCode) : [];
  const geocoded = await geocodeHomePlace(city, countryCode);
  const latitude = geocoded?.latitude ?? (countryItems.length
    ? countryItems.reduce((sum, item) => sum + item.latitude, 0) / countryItems.length
    : waypoints[0]?.latitude ?? 20);
  const longitude = geocoded?.longitude ?? (countryItems.length
    ? countryItems.reduce((sum, item) => sum + item.longitude, 0) / countryItems.length
    : waypoints[0]?.longitude ?? 0);
  const title = [city, countryCode ? getCountryName(countryCode) : null].filter(Boolean).join(", ") || "Home";
  const home: JourneyWaypoint = { kind: "home", item_id: "__home__", title, category: "home", latitude, longitude, done_at: now.toISOString() };
  return {
    origin: { latitude, longitude, title },
    waypoints: waypoints.length ? [...waypoints, { ...home, item_id: "__home_return__" }] : [],
    exploredCount: waypoints.length,
  };
}
