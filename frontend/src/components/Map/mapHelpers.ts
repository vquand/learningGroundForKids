import type L from 'leaflet';
import type { ItemSummary } from '../../types/item';
import { rememberExploreViewport } from './exploreViewport.ts';

export function saveMapViewport(map: L.Map | null, family: string, profile: string) {
  if (!map) return;
  const center = map.getCenter();
  rememberExploreViewport(family, profile, { center: [center.lat, center.lng], zoom: map.getZoom() });
}

export function markerState(item: ItemSummary, done: ReadonlySet<string>, wip: ReadonlySet<string>) {
  return done.has(item.id) ? 'done' : wip.has(item.id) && item.quiz_required ? 'wip' : 'default';
}

export function indexMapItems(items: readonly ItemSummary[]) {
  const index = new Map<string, ItemSummary>();
  for (const item of items) if (!index.has(item.id)) index.set(item.id, item);
  return index;
}
