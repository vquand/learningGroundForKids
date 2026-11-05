import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemSummaryRecord } from '../src/contracts/db.js';
import type { SnapshotStore } from '../src/explore/snapshots.js';
import { CachedCatalog, type CatalogSource } from '../src/explore/catalog.js';

const item = (id: string): ItemSummaryRecord => ({ id, title: id, category: 'animal', latitude: 1, longitude: 1, icon_slug: 'animal', has_quiz: false, quiz_required: false });
function fixture() {
  let catalogRevision = '1', visibilityRevision = '1', exceptions = false, commonReads = 0, scopeReads = 0;
  let shared = [item('common-a'), item('common-b')], permitted = ['common-b', 'private-a'];
  const rows = new Map<string, unknown>();
  const store: SnapshotStore = {
    async read(key) { return rows.get(key.id) ?? null; },
    async claim() { return { state: 'claimed', fence: 1 }; },
    async complete(key, _owner, _fence, value) {
      if (key.catalogRevision !== catalogRevision || (key.visibilityRevision !== null && key.visibilityRevision !== visibilityRevision)) return false;
      rows.set(key.id, value); return true;
    },
    async fail() {},
  };
  const source: CatalogSource = {
    async context(scope) { return { catalogRevision, visibilityRevision, hasExceptions: exceptions && scope.familyId === 'a' }; },
    async common() { commonReads++; return shared; },
    async visibleIds() { scopeReads++; return permitted; },
    async hydrate(_scope, ids) { return ids.map(item); },
  };
  return { source, store, rows, stats: () => ({ commonReads, scopeReads }),
    hide() { exceptions = true; visibilityRevision = '2'; permitted = ['common-b']; },
    scope() { exceptions = true; },
    edit() { catalogRevision = '2'; shared = [item('common-a-updated')]; } };
}

test('ten independent families reuse one common materialization while every call checks current access', async () => {
  const f = fixture(), catalog = new CachedCatalog(f.store, f.source);
  let checks = 0; const context = f.source.context;
  f.source.context = async scope => { checks++; return context(scope); };
  const values = await Promise.all(Array.from({ length: 10 }, (_, i) => catalog.list({ familyId: String(i), limit: 5000 })));
  assert.ok(values.every(value => value.length === 2));
  assert.deepEqual(f.stats(), { commonReads: 1, scopeReads: 0 });
  assert.equal(checks, 20, 'check before cache lookup and again after asynchronous work');
});

test('scoped membership is merged on the server and private rows never enter the common snapshot', async () => {
  const f = fixture(); f.scope();
  const catalog = new CachedCatalog(f.store, f.source);
  assert.deepEqual((await catalog.list({ familyId: 'a', profileId: 'kid-a', limit: 5000 })).map(i => i.id), ['common-b', 'private-a']);
  assert.deepEqual((await catalog.list({ familyId: 'b', profileId: 'kid-b', limit: 5000 })).map(i => i.id), ['common-a', 'common-b']);
  const common = [...f.rows.values()][0] as { items: ItemSummaryRecord[] };
  assert.deepEqual(common.items.map(i => i.id), ['common-a', 'common-b']);
  assert.equal(f.stats().commonReads, 1);
});

test('catalog builders pass cancellation to every source load', async () => {
  const f = fixture(); f.scope();
  const common = f.source.common, visible = f.source.visibleIds, hydrate = f.source.hydrate;
  let calls = 0;
  f.source.common = async (category, signal) => { assert.ok(signal instanceof AbortSignal); calls++; return common(category, signal); };
  f.source.visibleIds = async (scope, signal) => { assert.ok(signal instanceof AbortSignal); calls++; return visible(scope, signal); };
  f.source.hydrate = async (scope, ids, signal) => { assert.ok(signal instanceof AbortSignal); calls++; return hydrate(scope, ids, signal); };
  assert.equal((await new CachedCatalog(f.store, f.source).list({ familyId: 'a', limit: 5000 })).length, 2);
  assert.equal(calls, 3);
});

test('a warm cache immediately respects a new visibility revision without rebuilding the common catalog', async () => {
  const f = fixture(), catalog = new CachedCatalog(f.store, f.source);
  assert.equal((await catalog.list({ familyId: 'a', limit: 5000 })).length, 2);
  f.hide();
  assert.deepEqual((await catalog.list({ familyId: 'a', limit: 5000 })).map(i => i.id), ['common-b']);
  assert.equal(f.stats().commonReads, 1);
  assert.equal((await catalog.list({ familyId: 'b', limit: 5000 })).length, 2);
});

test('a new catalog revision cannot reuse the old hot or durable payload; limits remain bounded', async () => {
  const f = fixture(), catalog = new CachedCatalog(f.store, f.source);
  assert.equal((await catalog.list({ familyId: 'a', limit: 1 })).length, 1);
  f.edit();
  assert.deepEqual((await catalog.list({ familyId: 'a', limit: 5000 })).map(i => i.id), ['common-a-updated']);
  assert.equal(f.stats().commonReads, 2);
});

test('prepared projections share only authorized common membership and recover durably', async () => {
  const f = fixture(), catalog = new CachedCatalog(f.store, f.source);
  let builds = 0;
  const build = async (items: ItemSummaryRecord[]) => { builds++; return { ids: items.map(i => i.id) }; };
  const parse = (value: unknown) => value as { ids: string[] };
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => catalog.project({ familyId: String(i) }, 'test-projection', build, parse)));
  assert.equal(new Set(results.map(r => r.version)).size, 1); assert.equal(builds, 1);
  assert.ok(results.every(r => r.shared));
  await new CachedCatalog(f.store, f.source).project({ familyId: 'a' }, 'test-projection', build, parse);
  assert.equal(builds, 1, 'restart must not rebuild an unchanged projection');
  f.scope();
  const scoped = await catalog.project({ familyId: 'a', profileId: 'kid' }, 'test-projection', build, parse);
  assert.equal(scoped.shared, false); assert.notEqual(scoped.version, results[0]!.version);
  assert.deepEqual(scoped.value.ids, ['common-b', 'private-a']);
  f.hide();
  assert.deepEqual((await catalog.project({ familyId: 'a', profileId: 'kid' }, 'test-projection', build, parse)).value.ids, ['common-b']);
});

test('item-derived variants retry a validation error if catalog access changed after materialization', async () => {
  const f = fixture(), catalog = new CachedCatalog(f.store, f.source); let changed = false;
  const result = await catalog.project({ familyId: 'a' }, () => {
    if (!changed) { changed = true; f.edit(); throw new Error('stale timeline'); }
    return 'validated-current-timeline';
  }, async items => items.map(i => i.id), value => value as string[]);
  assert.deepEqual(result.value, ['common-a-updated']);
});


test('projections use two access reads and retry revocation or catalog edits during construction', async () => {
  for (const change of ['hide', 'edit'] as const) {
    const f = fixture(), catalog = new CachedCatalog(f.store, f.source);
    // Simulate publication winning the race; the final access check must reject it.
    f.store.complete = async (key, _owner, _fence, value) => { f.rows.set(key.id, value); return true; };
    let reads = 0, builds = 0;
    const context = f.source.context;
    f.source.context = async scope => { reads++; return context(scope); };
    const project = () => catalog.project({ familyId: 'a' }, 'race', async items => {
      if (++builds === 1) f[change]();
      return items.map(i => i.id);
    }, value => value as string[]);
    const result = await project();
    assert.deepEqual(result.value, change === 'hide' ? ['common-b'] : ['common-a-updated']);
    assert.equal(reads, 4, 'two checks on each attempt, including the changed revision');
    reads = 0;
    assert.deepEqual((await project()).value, result.value);
    assert.equal(reads, 2, 'hot projections also check both access boundaries');
  }
});
