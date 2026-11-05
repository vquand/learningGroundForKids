import assert from 'node:assert/strict';
import test from 'node:test';
import { PreparedMapLifecycle, completionRevision, timelineKey } from '../src/hooks/preparedMapLifecycle.ts';
import { preparedIdentity } from '../src/hooks/preparedMapLoader.ts';
import { ApiError } from '../src/api/core.ts';
import { useFamilyStore } from '../src/stores/familyStore.ts';
import { useFilterStore } from '../src/stores/filterStore.ts';
import type { ExploreView } from '../src/types/explore.ts';
const view: ExploreView = { version: 'a'.repeat(64), validator: 'b'.repeat(64), shared: false, total: 0, zoom: 2, timeline: [], next_offset: null, features: [] };
function pending() {
  let resolve!: (view: ExploreView) => void, reject!: (error: unknown) => void;
  const promise = new Promise<ExploreView>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('camera and completion changes retain previous view, but never mark an old revision ready', async () => {
  const model = new PreparedMapLifecycle();
  await model.load('child', 'camera', '0', async () => view, () => {} ).done;
  const next = pending();
  const load = model.load('child', 'camera2', '0', () => next.promise, () => {});
  assert.equal(model.read('child', 'camera2', '0').view, view);
  assert.equal(model.read('child', 'camera2', '0').ready, false);
  next.resolve({ ...view, zoom: 3 }); await load.done;
  assert.equal(model.read('child', 'camera', '0').view, view);
  const revised = pending();
  const revisionLoad = model.load('child', 'camera', '1', () => revised.promise, () => {});
  assert.equal(model.read('child', 'camera', '1').view, view);
  assert.equal(model.read('child', 'camera', '1').ready, false);
  const fresh = { ...view, total: 1 };
  revised.resolve(fresh); await revisionLoad.done;
  assert.equal(model.read('child', 'camera', '1').view, fresh);
  assert.equal(model.read('child', 'camera', '1').ready, true);
  assert.equal(model.read('child', 'camera2', '1').view, fresh, 'old camera revision is not a cache hit');
  assert.equal(model.read('child', 'camera2', '1').ready, false);
});
test('identity changes blank immediately; aborted and stale responses and errors are ignored', async () => {
  const model = new PreparedMapLifecycle();
  await model.load('child', 'camera', '', async () => view, () => {}).done;
  for (const identity of ['profile', 'language', 'progress', 'categories', 'year', 'session']) {
    assert.equal(model.read(identity, 'camera', '').view, null);
  }
  const old = pending(), fresh = pending();
  let timelines = 0;
  const a = model.load('old', 'camera', '', () => old.promise, () => {}, () => timelines++);
  await tick();
  a.cancel();
  const b = model.load('new', 'camera', '', () => fresh.promise, () => {}, () => timelines++);
  old.resolve(view); await a.done;
  assert.equal(model.read('new', 'camera', '').view, null);
  fresh.resolve(view); await b.done;
  assert.equal(timelines, 1);
  useFamilyStore.setState({ familyId: 'still-active' });
  const stale = pending();
  const c = model.load('new', 'camera', '', () => stale.promise, () => {});
  await tick();
  model.load('new', 'other', '', async () => view, () => {});
  stale.reject(new ApiError('unauthorized', 401, 'UNAUTHORIZED')); await c.done; await tick();
  assert.equal(model.read('new', 'other', '').error, false);
  assert.equal(useFamilyStore.getState().familyId, 'still-active', 'stale 401 cannot revoke the current session');
});
test('waiting completion queries do not fetch; mismatched query resolutions yield one revision', async () => {
  const model = new PreparedMapLifecycle(); let calls = 0;
  await model.load('child', 'camera', null, async () => { calls++; return view; }, () => {}).done;
  assert.equal(calls, 0);
  assert.equal(completionRevision('todo', undefined, new Set(), false), null);
  assert.equal(completionRevision('todo', 0, new Set(), false), null);
  const initial = completionRevision('todo', 0, new Set(), true);
  assert.equal(completionRevision('todo', 1, new Set(), true), null);
  assert.equal(completionRevision('todo', 0, new Set(['a']), true), null);
  assert.notEqual(completionRevision('todo', 1, new Set(['a']), true), initial);
  assert.equal(completionRevision('all', undefined, new Set(), false), '');
  const request = { categories: [], year: null, zoom: 2, bounds: [0, 0, 1, 1] as [number, number, number, number], progress: 'all' as const };
  assert.equal(preparedIdentity(request, 'session', 'child', 'en'), preparedIdentity({ ...request, categories: [] }, 'session', 'child', 'en'));
});
test('lifecycle handles 401 by dropping private data and INVALID_MAP_YEAR by clearing era', async () => {
  const model = new PreparedMapLifecycle();
  useFamilyStore.setState({ familyId: 'family' });
  await model.load('child', 'camera', '', async () => view, () => {}).done;
  await model.load('child', 'camera', '', async () => { throw new ApiError('sign in', 401, 'UNAUTHORIZED'); }, () => {}).done;
  assert.equal(model.read('child', 'camera', '').view, null);
  assert.equal(useFamilyStore.getState().familyId, null);
  useFilterStore.getState().setActiveYear(1500);
  await model.load('child', 'camera', '', async () => { throw new ApiError('bad year', 400, 'INVALID_MAP_YEAR'); }, () => {}).done;
  assert.equal(useFilterStore.getState().activeYear, null);
  assert.equal(model.read('child', 'camera', '').error, true);
});
test('timeline keys detect changed count distribution, progress and categories under the same catalog version', () => {
  const years = [{ year: 1000, count: 2 }, { year: 2000, count: 3 }];
  const key = timelineKey(years, 'v1', 'todo', []);
  assert.notEqual(key, timelineKey([{ year: 1000, count: 3 }, { year: 2000, count: 2 }], 'v1', 'todo', []));
  assert.notEqual(key, timelineKey(years, 'v1', 'done', []));
  assert.notEqual(key, timelineKey(years, 'v1', 'todo', ['animals']));
});

test('staggered completion resolutions retain markers and trigger exactly one new request in either order', async () => {
  for (const countFirst of [true, false]) {
    const model = new PreparedMapLifecycle();
    let calls = 0;
    const fetch = async () => { calls++; return { ...view, total: calls }; };
    const initial = completionRevision('todo', 0, new Set(), true);
    await model.load('child', 'camera', initial, fetch, () => {}).done;
    const old = model.read('child', 'camera', initial).view;
    const waiting = completionRevision('todo', countFirst ? 1 : 0, new Set(countFirst ? [] : ['a']), true);
    await model.load('child', 'camera', waiting, fetch, () => {}).done;
    assert.equal(model.read('child', 'camera', waiting).view, old);
    assert.equal(model.read('child', 'camera', waiting).ready, false, 'leaf requests are disabled for retained markers');
    assert.equal(calls, 1);
    const revision = completionRevision('todo', 1, new Set(['a']), true);
    await model.load('child', 'camera', revision, fetch, () => {}).done;
    assert.equal(calls, 2);
    assert.equal(model.read('child', 'camera', revision).ready, true);
  }
});
