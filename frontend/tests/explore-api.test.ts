import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchExploreView, exploreViewKey, type ExploreViewStorage } from '../src/api/explore.ts';
import type { ExploreView } from '../src/types/explore.ts';

const request = { categories: ['food', 'animal'], year: null, zoom: 2, bounds: [-180, -85, 180, 85] as [number, number, number, number] };
const view: ExploreView = { version: 'a'.repeat(64), validator: 'c'.repeat(64), shared: true, total: 2, zoom: 2, next_offset: null, timeline: [{ year: 1500, count: 2 }],
  features: [{ id: 2, count: 2, latitude: 0, longitude: 0, bounds: [0, 0, 1, 1], expansionZoom: 9, item: null }] };
function storage() {
  const values = new Map<string, unknown>();
  const store: ExploreViewStorage = { async get(key) { return values.get(key); }, async put(key, value) { values.set(key, value); } };
  return { values, store };
}

test('a stored common view is never returned until the current server authorizes its version', async () => {
  const db = storage(); db.values.set(exploreViewKey(request), view);
  let release!: (value: Response) => void, resolved = false;
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async input => { assert.match(String(input), /known_version=c{64}/); return new Promise(resolve => { release = resolve; }); };
    const pending = fetchExploreView(request, 'kid-a', undefined, db.store).then(v => { resolved = true; return v; });
    await new Promise(resolve => setImmediate(resolve)); assert.equal(resolved, false);
    release(Response.json({ version: view.version, validator: view.validator, not_modified: true }));
    assert.deepEqual(await pending, view);
    globalThis.fetch = async () => Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in' } }, { status: 401 });
    await assert.rejects(fetchExploreView(request, 'kid-b', undefined, db.store), /Sign in/);
  } finally { globalThis.fetch = original; }
});

test('private results are not persisted and replacing an old common view requires a full server response', async () => {
  const db = storage(), original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ ...view, shared: false, version: 'b'.repeat(64) });
    const result = await fetchExploreView(request, 'kid-a', undefined, db.store);
    assert.equal(result.shared, false); assert.equal(db.values.size, 0);
    globalThis.fetch = async () => Response.json(view);
    await fetchExploreView(request, 'kid-a', undefined, db.store);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(db.values.size, 1);
    assert.ok(!JSON.stringify([...db.values]).includes('kid-a'), 'storage contains no child/family/session identity');
  } finally { globalThis.fetch = original; }
});

test('a late aborted cache revalidation cannot return a stored view', async () => {
  const db = storage(), original = globalThis.fetch, controller = new AbortController();
  db.values.set(exploreViewKey(request), view);
  try {
    globalThis.fetch = async () => { controller.abort(new Error('child changed')); return Response.json({ version: view.version, validator: view.validator, not_modified: true }); };
    await assert.rejects(fetchExploreView(request, 'kid-a', controller.signal, db.store), /child changed/);
  } finally { globalThis.fetch = original; }
});

test('view identity covers geometry, filters and pagination; malformed cache/server data is rejected', async () => {
  assert.equal(exploreViewKey(request), exploreViewKey({ ...request, categories: ['animal', 'food'] }));
  const keys = [exploreViewKey(request), exploreViewKey({ ...request, year: 1500 }), exploreViewKey({ ...request, zoom: 3 }),
    exploreViewKey({ ...request, bounds: [0, 0, 1, 1] }), exploreViewKey({ ...request, offset: 200 })];
  assert.equal(new Set(keys).size, keys.length);
  const db = storage(), original = globalThis.fetch;
  db.values.set(exploreViewKey(request), { ...view, features: [{ ...view.features[0], count: -1 }] });
  try {
    globalThis.fetch = async input => { assert.ok(!String(input).includes('known_version')); return Response.json(view); };
    assert.deepEqual(await fetchExploreView(request, null, undefined, db.store), view);
    globalThis.fetch = async () => Response.json({ ...view, features: [{ ...view.features[0], count: -1 }] });
    await assert.rejects(fetchExploreView(request, null, undefined, db.store), /Invalid prepared map/);
  } finally { globalThis.fetch = original; }
});

test('todo/done view and leaf requests send progress and bypass shared storage even if mislabeled shared', async () => {
  const { fetchExploreLeaves } = await import('../src/api/explore.ts');
  const original = globalThis.fetch;
  const forbidden: ExploreViewStorage = { async get() { assert.fail('private cache read'); }, async put() { assert.fail('private cache write'); } };
  try {
    for (const progress of ['todo', 'done'] as const) {
      globalThis.fetch = async input => {
        const url = new URL(String(input), 'http://localhost');
        assert.equal(url.searchParams.get('progress'), progress);
        assert.equal(url.searchParams.get('profile_id'), 'kid-a');
        return Response.json(url.pathname.endsWith('/leaves') ? { version: view.version, total: 1, items: [], next_offset: null } : view);
      };
      await fetchExploreView({ ...request, progress }, 'kid-a', undefined, forbidden);
      await fetchExploreLeaves({ ...request, progress, version: view.version, node: 2, offset: 0 }, 'kid-a');
    }
  } finally { globalThis.fetch = original; }
});

test('validated network data returns without waiting for persistent writes', async () => {
  const original = globalThis.fetch;
  let release!: () => void;
  let started = false;
  try {
    globalThis.fetch = async input => {
      assert.equal(new URL(String(input), 'http://localhost').searchParams.get('progress'), 'all');
      return Response.json(view);
    };
    const db: ExploreViewStorage = { async get() { return undefined; }, put() {
      started = true;
      return new Promise(resolve => { release = resolve; });
    } };
    assert.deepEqual(await fetchExploreView(request, 'kid-a', undefined, db), view);
    assert.equal(started, false, 'network data returns before background serialization starts');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(started, true);
    release();
  } finally { globalThis.fetch = original; }
});
