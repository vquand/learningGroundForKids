import { BAIT_IDS, BAITS as SERVER_BAITS, COMPANION_IDS, COMPANIONS, FISH_IDS, FISH as SERVER_FISH, LOCATIONS, CATCH_TABLES } from '../../../../server/src/fishing/catalog';
const COLORS = ['#e8a8b6', '#e8bf6c', '#93b58a', '#c4a3c9', '#99bfd1', '#bcaa83', '#e6b269'];
export const FRIENDS = COMPANION_IDS.map(id => COMPANIONS[id]);
export const BAITS = BAIT_IDS.map((id, i) => ({ ...SERVER_BAITS[id], color: COLORS[i] }));
export const FISH = FISH_IDS.map(id => SERVER_FISH[id]);
export const LOCATION_FISH = { pond: LOCATIONS.pond.fishIds, river: LOCATIONS.river.fishIds };
export const FISHING_SPOTS = Object.values(LOCATIONS);
export const ODDS = CATCH_TABLES;
