import assert from 'node:assert/strict';
import test from 'node:test';
import { exploreViewport, rememberExploreViewport } from '../src/components/Map/exploreViewport.ts';

test('Explore restores a child camera exactly and isolates children and login sessions', () => {
  const view = { center: [42.75, -73.125] as [number, number], zoom: 6.25 };
  rememberExploreViewport('family-a:1', 'kid-a', view);
  view.center[0] = 0;
  assert.deepEqual(exploreViewport('family-a:1', 'kid-a'), { center: [42.75, -73.125], zoom: 6.25 });
  assert.deepEqual(exploreViewport('family-a:1', 'kid-b'), { center: [20, 0], zoom: 2 });
  assert.equal(exploreViewport('family-a:1', 'kid-a').zoom, 6.25);
  assert.equal(exploreViewport('family-a:2', 'kid-a').zoom, 2);
  rememberExploreViewport('family-a:2', 'kid-a', { center: [0, 0], zoom: NaN });
  assert.equal(exploreViewport('family-a:2', 'kid-a').zoom, 2);
});
