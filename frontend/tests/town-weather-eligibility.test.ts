import assert from 'node:assert/strict';
import test from 'node:test';
import { ghostsMayVisit } from '../src/features/town-building/halloween.ts';

test('decorative ghosts follow the same fresh dry forecast gate as server harvests', () => {
  const weather = { localDate: '2026-10-30', precipitation: 'none' as const, timeOfDay: 'night', isDay: false, weatherSource: 'live' };
  assert.equal(ghostsMayVisit(weather), true);
  for (const weatherSource of ['stale', 'unavailable', 'preview', undefined]) assert.equal(ghostsMayVisit({ ...weather, weatherSource }), false);
  assert.equal(ghostsMayVisit({ ...weather, precipitation: 'rain' }), false);
  assert.equal(ghostsMayVisit({ ...weather, localDate: '2026-11-01' }), false);
  assert.equal(ghostsMayVisit({ ...weather, timeOfDay: null }), false);
  assert.equal(ghostsMayVisit({ ...weather, isDay: true }), false);
});

test('explicit development preview remains cosmetic and still respects wet or daylight appearance', () => {
  const weather = { localDate: '2026-11-01', precipitation: 'none' as const, timeOfDay: 'night', isDay: false, weatherSource: 'preview' };
  assert.equal(ghostsMayVisit(weather, true), true);
  assert.equal(ghostsMayVisit({ ...weather, precipitation: 'rain' }, true), false);
  assert.equal(ghostsMayVisit({ ...weather, isDay: true }, true), false);
});
