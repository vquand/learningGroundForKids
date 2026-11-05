import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMapLeavesQuery, parseMapViewQuery } from '../src/explore/http.js';
import { parsePreparedMap } from '../src/explore/maps.js';
import { buildClusterTree } from '../src/explore/clusters.js';

test('map query boundaries reject invalid geometry, paging, filters and client-supplied scope', () => {
  for (const query of ['zoom=NaN', 'zoom=19', 'zoom=', 'bounds=0,10,1,-10', 'bounds=-180,-90,181,90',
    'bounds=0,,1,2', 'bounds=0,0,1', 'limit=0', 'limit=501', 'offset=-1', 'year=2147483648',
    'categories=private', 'family_id=other', 'profile_id=a&profile_id=b', 'known_version=bad']) {
    assert.throws(() => parseMapViewQuery(new URLSearchParams(query)), query);
  }
  const parsed = parseMapViewQuery(new URLSearchParams('zoom=4.25&bounds=170,-85,-170,85&categories=food,animal,food'));
  assert.deepEqual(parsed.categories, ['animal', 'food']); assert.equal(parsed.zoom, 4.25);
  assert.deepEqual(parsed.bounds, [170, -85, -170, 85]);
  assert.deepEqual(parseMapViewQuery(new URLSearchParams('bounds=180,-90,-180,90')).bounds, [-180, -90, 180, 90]);
  for (const query of ['version=bad', `version=${'a'.repeat(64)}&limit=999`, `version=${'a'.repeat(64)}&scope=other`]) {
    assert.throws(() => parseMapLeavesQuery(new URLSearchParams(query), '2'));
  }
  assert.throws(() => parseMapLeavesQuery(new URLSearchParams(`version=${'a'.repeat(64)}`), '-1'));
});

test('durable map parsing rejects cycles, missing references, duplicate roots and oversized shapes', async () => {
  const tree = await buildClusterTree([{ id: 'i', title: 'Item', category: 'animal', latitude: 0, longitude: 0, icon_slug: 'animal', has_quiz: false, quiz_required: false }]);
  const valid = { format: 1, tree, timeline: [] };
  assert.deepEqual(parsePreparedMap(valid), valid);
  for (const change of [(v: typeof valid) => { v.tree.nodes[0]!.children = [0]; },
    (v: typeof valid) => { v.tree.levels[0] = [1]; }, (v: typeof valid) => { v.tree.levels[0] = [0, 0]; },
    (v: typeof valid) => { v.tree.levels = []; }]) {
    const broken = structuredClone(valid); change(broken); assert.throws(() => parsePreparedMap(broken));
  }
});


test('progress defaults to all and accepts only the three bounded filter values on views and leaves', () => {
  assert.equal(parseMapViewQuery(new URLSearchParams()).progress, 'all');
  assert.equal(parseMapViewQuery(new URLSearchParams()).limit, 200);
  for (const progress of ['all', 'todo', 'done']) {
    assert.equal(parseMapViewQuery(new URLSearchParams({ progress })).progress, progress);
    assert.equal(parseMapLeavesQuery(new URLSearchParams({ progress, version: 'a'.repeat(64) }), '0').progress, progress);
  }
  for (const progress of ['', 'other', 'DONE']) assert.throws(() => parseMapViewQuery(new URLSearchParams({ progress })));
  assert.throws(() => parseMapViewQuery(new URLSearchParams('progress=all&progress=done')));
});
