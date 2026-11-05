import assert from 'node:assert/strict';
import test from 'node:test';
import { indexMapItems, markerState, saveMapViewport } from '../src/components/Map/mapHelpers.ts';
import { exploreViewport } from '../src/components/Map/exploreViewport.ts';
import type L from 'leaflet';
import type { ItemSummary } from '../src/types/item.ts';
const item: ItemSummary = { id: 'leaf', title: 'Leaf', category: 'food', latitude: 0, longitude: 0, icon_slug: 'food', quiz_required: true, has_quiz: true };

test('indexed marker lookup preserves first-match semantics and replaces obsolete items', () => {
  assert.equal(indexMapItems([item, { ...item, title: 'duplicate' }]).get(item.id), item);
  assert.equal(indexMapItems([]).get(item.id), undefined);
});
test('done wins over wip; wip requires a quiz', () => {
  const ids = new Set([item.id]);
  assert.equal(markerState(item, ids, ids), 'done');
  assert.equal(markerState(item, new Set(), ids), 'wip');
  assert.equal(markerState({ ...item, quiz_required: false }, new Set(), ids), 'default');
});
test('shared camera saver keeps fractional zoom and tolerates an unmounted map', () => {
  saveMapViewport(null, 'm2-session', 'a');
  saveMapViewport({ getCenter: () => ({ lat: 15, lng: 105 }), getZoom: () => 6.25 } as unknown as L.Map, 'm2-session', 'a');
  assert.deepEqual(exploreViewport('m2-session', 'a'), { center: [15, 105], zoom: 6.25 });
  assert.deepEqual(exploreViewport('m2-session', 'b'), { center: [20, 0], zoom: 2 });
});
