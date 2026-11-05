import { BAIT_IDS, COMPANION_IDS, LOCATIONS } from './catalog.ts';

const art = { badge: '/minigames/fishing/achievement-badges.png', badgeColumns: 4, badgeRows: 2 } as const;
export const FISHING_ACHIEVEMENTS = [
  { ...art, id: 'fishing-first-nibble', name: 'First Nibble', description: 'Catch any fish once.', badgeIndex: 0, difficulty: 'easy', metric: 'fishingCaught', target: 1 },
  { ...art, id: 'fishing-pond-graduate', name: 'Pond Champion', description: 'Reach 60 fishing points at Little Pond.', badgeIndex: 1, difficulty: 'medium', metric: 'fishingPondPoints', target: 60 },
  { ...art, id: 'fishing-river-graduate', name: 'River Champion', description: 'Reach 180 fishing points at Village River.', badgeIndex: 2, difficulty: 'hard', metric: 'fishingRiverPoints', target: 180 },
  { ...art, id: 'fishing-pond-fishbook', name: 'Pond Fishbook', description: 'Discover all six pond catches, including the turtle.', badgeIndex: 3, difficulty: 'hard', metric: 'fishingPondSpecies', target: 6 },
  { ...art, id: 'fishing-river-fishbook', name: 'River Fishbook', description: 'Discover all seven river catches, including the minnow and turtle.', badgeIndex: 4, difficulty: 'hard', metric: 'fishingRiverSpecies', target: 7 },
  { ...art, id: 'fishing-full-bait-box', name: 'A Full Bait Box', description: 'Earn all seven bait types through math.', badgeIndex: 5, difficulty: 'medium', metric: 'fishingBaits', target: 7 },
  { ...art, id: 'fishing-good-company', name: 'Good Company', description: 'Complete a successful catch with all three animal friends.', badgeIndex: 6, difficulty: 'easy', metric: 'fishingFriends', target: 3 },
] as const;

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const unique = (value: unknown, allowed: readonly string[]): number => Array.isArray(value) ? new Set(value.filter((id): id is string => typeof id === 'string' && allowed.includes(id))).size : 0;
/** Safe for old/malformed persisted report projections; never counts unknown IDs. */
export function fishingAchievementMetrics(value: unknown) {
  const state = record(value), points = record(state.points), stats = record(state.stats), discovered = record(state.discovered);
  return {
    fishingCaught: count(stats.caught), fishingPondPoints: count(points.pond), fishingRiverPoints: count(points.river),
    fishingPondSpecies: unique(discovered.pond, LOCATIONS.pond.fishIds), fishingRiverSpecies: unique(discovered.river, LOCATIONS.river.fishIds),
    fishingBaits: unique(state.earnedBaits, BAIT_IDS), fishingFriends: unique(state.friendCatches, COMPANION_IDS),
  };
}
