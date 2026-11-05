import assert from 'node:assert/strict';
import test from 'node:test';
import { CachedCatalog } from '../src/explore/catalog.js';
import type { SnapshotStore } from '../src/explore/snapshots.js';
import type { ItemSummaryRecord } from '../src/contracts/db.js';
import type { MapViewInput, MapView } from '../src/explore/contracts.js';
import { ExploreMaps } from '../src/explore/maps.js';

function fixture() {
  const rows = new Map<string, unknown>(); let visibility = '1', exceptions = false;
  const items: ItemSummaryRecord[] = Array.from({ length: 60 }, (_, i) => ({ id: `i-${i}`, title: `Item ${i}`,
    category: i % 2 ? 'animal' : 'food', latitude: 0, longitude: i % 10, icon_slug: 'animal', has_quiz: false,
    quiz_required: false, start_year: i % 2 ? 2026 : 1500, end_year: i % 2 ? null : 1600 }));
  items.push({ ...items[0]!, id: 'dateline', longitude: 179.9 });
  const store: SnapshotStore = { async read(k) { return rows.get(k.id) ?? null; }, async claim() { return { state: 'claimed', fence: 1 }; },
    async complete(k, _o, _f, v) { if (k.visibilityRevision && k.visibilityRevision !== visibility) return false; rows.set(k.id, v); return true; }, async fail() {} };
  const source = { async context(scope: { familyId: string }) { return { catalogRevision: '1', visibilityRevision: visibility, hasExceptions: exceptions && scope.familyId === 'a' }; },
    async common() { return items; }, async visibleIds() { return ['i-1']; }, async hydrate() { return []; } };
  const catalog = new CachedCatalog(store, source);
  const done = new Map<string, string[]>();
  const progress = async (scope: { familyId: string; profileId?: string }) => done.get(`${scope.familyId}:${scope.profileId}`) ?? [];
  return { maps: new ExploreMaps(catalog, progress), rows, catalog, done, restart: () => new ExploreMaps(new CachedCatalog(store, source), progress),
    hide() { visibility = '2'; exceptions = true; } };
}
const input: MapViewInput = { familyId: 'a', categories: [], year: null, zoom: 2, bounds: [-180, -90, 180, 90], offset: 0, limit: 500 };
const full = (v: unknown): MapView => { assert.ok(v && typeof v === 'object' && !('not_modified' in v)); return v as MapView; };

test('map views share prepared hierarchies, retain exact counts and reuse durable results after restart', async () => {
  const f = fixture();
  const values = await Promise.all(Array.from({ length: 10 }, (_, i) => f.maps.view({ ...input, familyId: String(i) })));
  const view = full(values[0]); assert.equal(view.total, 61); assert.equal(view.shared, true);
  assert.equal(view.features.reduce((n, f) => n + f.count, 0), 61);
  assert.ok(values.every(v => v.version === view.version));
  assert.equal(f.catalog.cache.stats.builds, 2, 'one catalog and one hierarchy, no nested duplicate builds');
  assert.deepEqual(full(await f.restart().view(input)), view);
  assert.deepEqual(await f.maps.view({ ...input, knownVersion: view.validator }), { version: view.version, validator: view.validator, not_modified: true });
});

test('year/category filters change versions and are applied before clustering; current-year open ends are versioned', async () => {
  const f = fixture(), all = full(await f.maps.view(input));
  const historical = full(await f.maps.view({ ...input, categories: ['food', 'food'], year: 1500 }));
  assert.equal(historical.total, 31); assert.notEqual(historical.version, all.version);
  const modern = full(await f.maps.view({ ...input, year: 2026 }));
  assert.equal(modern.total, 30);
  await assert.rejects(f.maps.view({ ...input, year: 2147483647 }), /timeline/);
  assert.equal(full(await f.maps.view({ ...input, categories: ['animal', 'food'] })).version,
    full(await f.maps.view({ ...input, categories: ['food', 'animal'] })).version);
  assert.equal(all.timeline.reduce((sum, r) => sum + r.count, 0), 61);
});

test('invalid year churn cannot admit projection jobs or evict the current view', async () => {
  const f = fixture(), view = full(await f.maps.view(input)), before = f.catalog.cache.stats;
  for (let year = 5000; year < 5030; year++) await assert.rejects(f.maps.view({ ...input, year }), /timeline/);
  assert.equal(f.catalog.cache.stats.builds, before.builds);
  assert.equal(f.catalog.cache.stats.entries, before.entries);
  assert.deepEqual(await f.maps.view({ ...input, knownVersion: view.validator }), { version: view.version, validator: view.validator, not_modified: true });
  for (const change of [{ zoom: 3 }, { bounds: [0, -10, 2, 10] as typeof input.bounds }, { offset: 1 }, { limit: 1 }]) {
    const changed = full(await f.maps.view({ ...input, ...change, knownVersion: view.validator }));
    assert.notEqual(changed.validator, view.validator, 'validators are bound to the exact view request');
  }
});

test('viewport/dateline and bounded view/leaf pages never drop membership', async () => {
  const f = fixture(), zoom = full(await f.maps.view({ ...input, zoom: 18, limit: 3 }));
  assert.equal(zoom.features.length, 3); assert.equal(zoom.next_offset, 3);
  const seam = full(await f.maps.view({ ...input, zoom: 18, bounds: [170, -10, -170, 10] }));
  assert.deepEqual(seam.features.map(f => f.item?.id), ['dateline']);
  const root = full(await f.maps.view(input)).features.find(n => n.count > 1)!;
  const ids: string[] = [];
  for (let offset = 0; offset < root.count; offset += 7) {
    const page = await f.maps.leaves({ familyId: 'a', categories: [], year: null, version: zoom.version, node: root.id, offset, limit: 7 });
    ids.push(...page.items.map(i => i.id));
  }
  assert.equal(ids.length, 60); assert.equal(new Set(ids).size, 60);
});

test('warm views and leaf requests recheck visibility; old versions and another family cannot resolve a private node', async () => {
  const f = fixture(), before = full(await f.maps.view(input)); f.hide();
  const scoped = full(await f.maps.view({ ...input, knownVersion: before.version }));
  assert.equal(scoped.shared, false); assert.equal(scoped.total, 1); assert.notEqual(scoped.version, before.version);
  await assert.rejects(f.maps.leaves({ familyId: 'a', categories: [], year: null, version: before.version, node: before.features[0]!.id, offset: 0, limit: 7 }), /changed/);
  await assert.rejects(f.maps.leaves({ familyId: 'b', categories: [], year: null, version: scoped.version, node: scoped.features[0]!.id, offset: 0, limit: 7 }), /changed/);
});


test('progress views filter shared membership, recount and reposition clusters without persisting progress', async () => {
  const f = fixture(), scope = { ...input, profileId: 'kid' };
  const all = full(await f.maps.view(scope)), bytes = JSON.stringify([...f.rows]);
  f.done.set('a:kid', ['i-0', 'i-10', 'dateline']);
  const done = full(await f.maps.view({ ...scope, progress: 'done' }));
  const todo = full(await f.maps.view({ ...scope, progress: 'todo' }));
  assert.equal(done.total, 3); assert.equal(todo.total, 58);
  assert.equal(done.shared, false); assert.equal(todo.shared, false);
  assert.equal(done.features.reduce((n, f) => n + f.count, 0), 3);
  assert.equal(todo.features.reduce((n, f) => n + f.count, 0), 58);
  const cluster = done.features.find(n => n.count === 2)!;
  assert.equal(cluster.longitude, 0); assert.deepEqual(cluster.bounds, [0, 0, 0, 0]);
  const ids: string[] = [];
  for (let offset = 0; offset < 2; offset++) {
    const page = await f.maps.leaves({ ...scope, progress: 'done', version: done.version, node: cluster.id, offset, limit: 1 });
    assert.equal(page.total, 2); assert.equal(page.next_offset, offset === 0 ? 1 : null);
    ids.push(...page.items.map(i => i.id));
  }
  assert.deepEqual(ids.sort(), ['i-0', 'i-10']);
  const leaves = full(await f.maps.view({ ...scope, progress: 'done', zoom: 18 }));
  const leafIds: string[] = [];
  for (const feature of leaves.features) {
    const page = await f.maps.leaves({ ...scope, progress: 'done', version: done.version, node: feature.id, offset: 0, limit: 500 });
    leafIds.push(...page.items.map(i => i.id));
  }
  assert.deepEqual(leafIds.sort(), ['dateline', 'i-0', 'i-10']);
  assert.equal(JSON.stringify([...f.rows]), bytes, 'no profile IDs, progress, or private projections in snapshot bytes');
  assert.deepEqual(full(await f.maps.view({ ...scope, progress: 'all' })), all);
  assert.equal(f.catalog.cache.stats.builds, 2);
});

test('progress changes defeat stale validators and leaf versions immediately, with profile isolation', async () => {
  const f = fixture(), scope = { ...input, profileId: 'kid', progress: 'done' as const };
  const empty = full(await f.maps.view(scope));
  assert.equal(empty.total, 0); assert.deepEqual(empty.features, []);
  f.done.set('a:kid', ['i-1']);
  const done = full(await f.maps.view({ ...scope, knownVersion: empty.validator }));
  assert.equal(done.total, 1); assert.notEqual(done.validator, empty.validator); assert.notEqual(done.version, empty.version);
  assert.equal(done.features[0]!.item!.id, 'i-1');
  await assert.rejects(f.maps.leaves({ ...scope, version: empty.version, node: done.features[0]!.id, offset: 0, limit: 1 }), /changed/);
  for (const other of [{ familyId: 'a', profileId: 'sibling' }, { familyId: 'b', profileId: 'kid' }]) {
    const isolated = full(await f.maps.view({ ...scope, ...other, knownVersion: done.validator }));
    assert.equal(isolated.total, 0); assert.notEqual(isolated.version, done.version);
    await assert.rejects(f.maps.leaves({ ...scope, ...other, version: done.version, node: done.features[0]!.id, offset: 0, limit: 1 }), /changed/);
  }
  await assert.rejects(f.maps.view({ ...input, progress: 'todo' }), /profile/i);
});


test('progress viewport pages and category filters agree with filtered leaf membership', async () => {
  const f = fixture(), scope = { ...input, profileId: 'kid' };
  const completed = new Set(['i-0', 'i-10', 'i-1', 'dateline']);
  f.done.set('a:kid', [...completed]);
  for (const progress of ['todo', 'done'] as const) {
    const overview = full(await f.maps.view({ ...scope, progress, categories: ['food'] }));
    const ids: string[] = [];
    for (const feature of overview.features) {
      const leaves = await f.maps.leaves({ ...scope, progress, categories: ['food'], version: overview.version, node: feature.id, offset: 0, limit: 500 });
      ids.push(...leaves.items.map(i => i.id));
    }
    const expected = [...Array.from({ length: 30 }, (_, i) => `i-${i * 2}`), 'dateline']
      .filter(id => completed.has(id) === (progress === 'done')).sort();
    assert.deepEqual(ids.sort(), expected); assert.equal(overview.total, expected.length);
    const paged: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page: MapView = full(await f.maps.view({ ...scope, progress, categories: ['food'], zoom: 18, offset, limit: 1 }));
      for (const feature of page.features) {
        const leaves = await f.maps.leaves({ ...scope, progress, categories: ['food'], version: page.version, node: feature.id, offset: 0, limit: 500 });
        paged.push(...leaves.items.map(i => i.id));
      }
      offset = page.next_offset;
    }
    assert.deepEqual(paged.sort(), expected);
  }
});
