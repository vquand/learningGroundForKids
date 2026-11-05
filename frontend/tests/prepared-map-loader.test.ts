import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPreparedView, PreparedViewCache, preparedIdentity, exploreViewKey } from '../src/hooks/preparedMapLoader.ts';
import { profileProgress, useFilterStore } from '../src/stores/filterStore.ts';
import type { ExploreView } from '../src/types/explore.ts';

const request = { categories: [], year: null, progress: 'todo' as const, zoom: 2, bounds: [-180, -85, 180, 85] as [number, number, number, number] };
const view: ExploreView = { version: 'a'.repeat(64), validator: 'b'.repeat(64), shared: false, total: 4, zoom: 2, timeline: [], next_offset: null, features: [] };
const feature = (id: number) => ({ id, count: 2, latitude: 0, longitude: 0, bounds: [0, 0, 1, 1] as [number, number, number, number], expansionZoom: 3, item: null });

test('prepared pagination retries a revision flip without mixing old features', async () => {
  const offsets: number[] = [];
  let first = true;
  const result = await loadPreparedView(request, 'child', new AbortController().signal, async input => {
    offsets.push(input.offset ?? 0);
    if (!input.offset) return { ...view, features: [feature(1)], next_offset: 1 };
    if (first) { first = false; return { ...view, version: 'c'.repeat(64), features: [feature(9)] }; }
    return { ...view, validator: 'd'.repeat(64), features: [feature(2)] };
  });
  assert.deepEqual(offsets, [0, 1, 0, 1]);
  assert.deepEqual(result.features.map(f => f.id), [1, 2]);
  assert.equal(result.next_offset, null);
});

test('pagination rejects repeated offsets, duplicates and repeated version flips', async () => {
  await assert.rejects(loadPreparedView(request, null, new AbortController().signal, async () => ({ ...view, next_offset: 1 })), /pagination/);
  await assert.rejects(loadPreparedView(request, null, new AbortController().signal, async input => ({ ...view, features: [feature(1)], next_offset: input.offset ? null : 1 })), /pagination/);
  await assert.rejects(loadPreparedView(request, null, new AbortController().signal, async input => ({ ...view, version: input.offset ? 'c'.repeat(64) : view.version, next_offset: input.offset ? null : 1 })), /changed while loading/);
});

test('pagination stops on abort and propagates service failures', async () => {
  const controller = new AbortController();
  await assert.rejects(loadPreparedView(request, null, controller.signal, async () => {
    controller.abort(new Error('switched child'));
    return { ...view, next_offset: 1 };
  }), /switched child/);
});

test('camera changes retain markers, zoom-back is instant, meaning changes clear immediately', () => {
  const cache = new PreparedViewCache();
  const key = exploreViewKey(request);
  const identity = preparedIdentity(request, 'family:1', 'child', 'en');
  cache.read(identity, key);
  cache.put(identity, key, view);
  assert.deepEqual(cache.read(identity, 'zoom-in'), { view, hit: false });
  assert.deepEqual(cache.read(identity, key), { view, hit: true });
  for (const nextIdentity of [
    preparedIdentity(request, 'family:1', 'other-child', 'en'),
    preparedIdentity({ ...request, progress: 'done' }, 'family:1', 'child', 'en'),
    preparedIdentity(request, 'family:2', 'child', 'en'),
    preparedIdentity(request, 'family:1', 'child', 'vi'),
  ]) {
    assert.deepEqual(cache.read(nextIdentity, key), { view: null, hit: false });
    cache.put(identity, key, view);
    assert.equal(cache.read(nextIdentity, key).view, null, 'late old-identity results are ignored');
  }
});

test('camera cache is bounded and catalog changes invalidate old camera views', () => {
  const cache = new PreparedViewCache();
  cache.read('child', '0');
  for (let n = 0; n < 7; n++) cache.put('child', String(n), view);
  assert.equal(cache.read('child', '0').hit, false);
  assert.equal(cache.read('child', '1').hit, true);
  cache.put('child', 'new', { ...view, version: 'c'.repeat(64) });
  assert.equal(cache.read('child', '1').hit, false);
});

test('completion filter defaults to todo, stays per child/session, and changes request identity', () => {
  useFilterStore.getState().setProgress('family:1', 'a', 'done');
  assert.equal(profileProgress(useFilterStore.getState(), 'family:1', 'a'), 'done');
  assert.equal(profileProgress(useFilterStore.getState(), 'family:1', 'b'), 'todo');
  assert.equal(profileProgress(useFilterStore.getState(), 'family:2', 'a'), 'todo');
  assert.notEqual(exploreViewKey(request), exploreViewKey({ ...request, progress: 'all' }));
  assert.notEqual(exploreViewKey(request), exploreViewKey({ ...request, progress: 'done' }));
});

test('401 clears the session, INVALID_MAP_YEAR clears only the era, other errors preserve filters', async () => {
  const { handlePreparedMapError } = await import('../src/hooks/preparedMapLoader.ts');
  const { ApiError } = await import('../src/api/core.ts');
  const { useFamilyStore } = await import('../src/stores/familyStore.ts');
  useFilterStore.getState().setActiveYear(1500);
  handlePreparedMapError(new ApiError('bad year', 400, 'INVALID_MAP_YEAR'));
  assert.equal(useFilterStore.getState().activeYear, null);
  useFilterStore.getState().setActiveYear(1600);
  handlePreparedMapError(new Error('offline'));
  assert.equal(useFilterStore.getState().activeYear, 1600);
  useFamilyStore.setState({ familyId: 'family', sessionGeneration: 1 });
  handlePreparedMapError(new ApiError('sign in', 401, 'UNAUTHORIZED'));
  assert.equal(useFamilyStore.getState().familyId, null);
  assert.equal(useFamilyStore.getState().sessionGeneration, 2);
  assert.equal(handlePreparedMapError(new ApiError('revoked', 403, 'FORBIDDEN')), true);
  const cache = new PreparedViewCache();
  cache.read('child', 'camera');
  cache.put('child', 'camera', view);
  cache.clear();
  assert.equal(cache.read('child', 'camera').view, null);
});

test('authoritative feature pagination uses at most three concurrent requests and preserves page order', async () => {
  let active = 0;
  let peak = 0;
  const result = await loadPreparedView({ ...request, limit: 1 }, null, new AbortController().signal, async input => {
    const offset = input.offset ?? 0;
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, offset % 2 ? 3 : 0));
    active--;
    return { ...view, total: 16, feature_count: 8, features: [feature(offset)], next_offset: offset < 7 ? offset + 1 : null };
  });
  assert.equal(peak, 3);
  assert.deepEqual(result.features.map(f => f.id), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('parallel pagination retries version flips and refuses inconsistent authoritative metadata', async () => {
  let flipped = false;
  const result = await loadPreparedView({ ...request, limit: 1 }, null, new AbortController().signal, async input => {
    const offset = input.offset ?? 0;
    const version = offset && !flipped ? 'c'.repeat(64) : view.version;
    if (offset) flipped = true;
    return { ...view, version, feature_count: 2, features: [feature(offset)], next_offset: offset ? null : 1 };
  });
  assert.equal(result.version, view.version);
  assert.deepEqual(result.features.map(f => f.id), [0, 1]);
  await assert.rejects(loadPreparedView({ ...request, limit: 1 }, null, new AbortController().signal, async input => ({
    ...view, feature_count: input.offset ? 3 : 2, features: [feature(input.offset ?? 0)], next_offset: input.offset ? null : 1,
  })), /pagination/);
});

test('authoritative totals cannot silently truncate a prepared view', async () => {
  await assert.rejects(loadPreparedView(request, null, new AbortController().signal, async () => ({
    ...view, feature_count: 2, features: [feature(1)], next_offset: null,
  })), /pagination/);
});


test('nonzero pagination offsets allow an empty suffix beyond the feature total', async () => {
  const result = await loadPreparedView({ ...request, offset: 5 }, null, new AbortController().signal,
    async () => ({ ...view, feature_count: 2, features: [] }));
  assert.deepEqual(result.features, []);
  const suffix = await loadPreparedView({ ...request, offset: 1, limit: 1 }, null, new AbortController().signal,
    async input => ({ ...view, feature_count: 3, total: 6, features: [feature(input.offset!)], next_offset: input.offset === 1 ? 2 : null }));
  assert.deepEqual(suffix.features.map(f => f.id), [1, 2]);
});
