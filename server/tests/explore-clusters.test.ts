import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemSummaryRecord } from '../src/contracts/db.js';
import { buildClusterTree, clusterLeaves, clusterLevel, clusterLevelPage, filterClusterTree, type ClusterTree } from '../src/explore/clusters.js';

const item = (id: string, latitude: number, longitude: number): ItemSummaryRecord => ({
  id, latitude, longitude, title: id, category: 'animal', icon_slug: 'animal', quiz_required: false, has_quiz: false,
});
function members(tree: ClusterTree, node: number): string[] {
  const row = tree.nodes[node]!;
  return row.itemIndex === null ? row.children.flatMap(child => members(tree, child)) : [tree.items[row.itemIndex]!.id];
}

test('every zoom band preserves exact membership and clusters have weighted centroids and bounds', async () => {
  const tree = await buildClusterTree([item('a', 0, 0), item('b', 0, 1), item('c', 0, 2), item('far', 30, 100)]);
  for (let zoom = 2; zoom <= 18; zoom++) {
    const nodes = clusterLevel(tree, zoom);
    assert.deepEqual(nodes.flatMap(node => members(tree, node.id)).sort(), ['a', 'b', 'c', 'far']);
    assert.equal(nodes.reduce((sum, n) => sum + n.count, 0), 4);
  }
  const cluster = clusterLevel(tree, 2).find(n => n.count === 3)!;
  assert.ok(Math.abs(cluster.longitude - 1) < 1e-8);
  assert.ok(Math.abs(cluster.latitude) < 1e-8);
  assert.deepEqual(cluster.bounds, [0, 0, 2, 0]);
  assert.ok(cluster.expansionZoom > 2 && cluster.expansionZoom <= 18);
  assert.deepEqual(clusterLevel(tree, 2.75), clusterLevel(tree, 2));
});

test('clusters join across the dateline and polar projection remains finite', async () => {
  const tree = await buildClusterTree([item('east', 0, 179.9), item('west', 0, -179.9), item('north', 90, 40), item('south', -90, 40)]);
  const cluster = clusterLevel(tree, 2).find(n => n.count === 2)!;
  assert.ok(Math.abs(Math.abs(cluster.longitude) - 180) < 1e-8);
  assert.ok(cluster.bounds[2] - cluster.bounds[0] < 0.21, 'bounds take the short arc');
  assert.ok(tree.nodes.every(node => [node.x, node.y].every(Number.isFinite)));
  assert.ok(clusterLevel(tree, 18).every(node => Number.isFinite(node.latitude)));
});

test('coincident clusters retain all leaves and provide bounded deterministic spiderfy pages', async () => {
  const input = Array.from({ length: 4000 }, (_, i) => item(`item-${i.toString().padStart(4, '0')}`, 20, 0));
  const tree = await buildClusterTree(input), overview = clusterLevel(tree, 2);
  assert.equal(overview.length, 1); assert.equal(overview[0]!.count, 4000);
  assert.equal(overview[0]!.expansionZoom, 19, 'past max zoom means spiderfy');
  const ids: string[] = [];
  for (let offset = 0; offset < 4000; offset += 200) ids.push(...clusterLeaves(tree, overview[0]!.id, offset, 200).map(i => i.id));
  assert.deepEqual(ids, input.map(i => i.id));
  assert.ok(tree.nodes.length < input.length * 2);
  assert.ok(Buffer.byteLength(JSON.stringify(tree)) < 8 * 1024 * 1024);
  assert.throws(() => clusterLeaves(tree, overview[0]!.id, 0, 501));
  assert.throws(() => clusterLeaves(tree, -1, 0, 100));
});

test('hierarchies are deterministic regardless of source ordering and bounded at admission', async () => {
  const input = Array.from({ length: 100 }, (_, i) => item(`i-${i}`, i / 10, i / 20));
  assert.deepEqual(await buildClusterTree(input), await buildClusterTree([...input].reverse()));
  await assert.rejects(async () => buildClusterTree(Array.from({ length: 5001 }, (_, i) => item(String(i), 0, 0))));
  await assert.rejects(async () => buildClusterTree([item('invalid', NaN, 0)]));
  await assert.rejects(async () => buildClusterTree([item('a', 0, 0), item('a', 0, 0)]));
  const aborted = new AbortController(); aborted.abort(new Error('cancelled hierarchy'));
  await assert.rejects(async () => buildClusterTree(input, aborted.signal), /cancelled hierarchy/);
  const empty = await buildClusterTree([]);
  assert.deepEqual(clusterLevel(empty, 2), []);
  assert.throws(() => clusterLevel(empty, Infinity));
});

test('scheduled cancellation interrupts a hierarchy after work has begun', async () => {
  const controller = new AbortController();
  const input = Array.from({ length: 5000 }, (_, i) => item(String(i), 20, 0));
  const build = Promise.resolve(buildClusterTree(input, controller.signal));
  const rejected = assert.rejects(build, /cancelled during build/);
  setImmediate(() => controller.abort(new Error('cancelled during build')));
  await rejected;
});

test('radius boundaries work in ordinary and wrapped cells; exact seams use -180', async () => {
  const degrees = 60 / (256 * 2 ** 2) * 360;
  for (const longitude of [0, -180]) {
    const other = longitude === 0 ? degrees : 180 - degrees;
    assert.equal(clusterLevel(await buildClusterTree([item('a', 0, longitude), item('b', 0, other)]), 2).length, 1);
    const outside = longitude === 0 ? other + 1e-7 : other - 1e-7;
    assert.equal(clusterLevel(await buildClusterTree([item('a', 0, longitude), item('b', 0, outside)]), 2).length, 2);
  }
  for (const longitude of [-180, 180]) {
    const tree = await buildClusterTree([item('seam', 0, longitude)]), feature = clusterLevel(tree, 18)[0]!;
    assert.equal(feature.longitude, -180); assert.equal(feature.item!.longitude, -180);
    assert.deepEqual(feature.bounds, [-180, 0, -180, 0]);
    assert.equal(clusterLeaves(tree, feature.id, 0, 1)[0]!.longitude, -180);
  }
});

test('leaf pagination skips uneven nested subtrees without gaps or duplicates', async () => {
  const input = Array.from({ length: 101 }, (_, i) => item(`i-${i}`, i / 10, i / 20));
  const tree = await buildClusterTree(input), root = clusterLevel(tree, 2)[0]!;
  assert.equal(root.count, input.length);
  assert.ok(tree.nodes[root.id]!.children.some(id => tree.nodes[id]!.children.length > 0));
  assert.ok(tree.nodes.every(node => node.children.every(child => child < node.id)));
  const ids: string[] = [];
  for (let offset = 0; offset < input.length; offset += 7) ids.push(...clusterLeaves(tree, root.id, offset, 7).map(i => i.id));
  assert.deepEqual(ids, members(tree, root.id));
  assert.deepEqual([...ids].sort(), input.map(i => i.id).sort());
  assert.deepEqual(clusterLeaves(tree, root.id, input.length, 7), []);
});


test('bounds-first pages count matches in order and never construct off-page features', async () => {
  const tree = await buildClusterTree([item('a', 0, -179.9), item('b', 0, 0), item('c', 0, 179.9)]);
  const expected = clusterLevel(tree, 18).filter(f => Math.abs(f.longitude) > 170);
  for (const bounds of [[170, -10, -170, 10], [170, -10, 190, 10], [-190, -10, -170, 10]] as const) {
    for (let offset = 0; offset <= 2; offset++) {
      const page = clusterLevelPage(tree, 18, [...bounds], offset, 1);
      assert.equal(page.total, 2);
      assert.deepEqual(page.features, expected.slice(offset, offset + 1));
    }
  }
  for (const row of tree.items) Object.defineProperty(row, 'title', { get() { throw new Error('off-page materialization'); } });
  // Exact seam normalization copies metadata when constructing a feature.
  tree.items[0]!.longitude = 180;
  assert.throws(() => clusterLevelPage(tree, 18, [170, -10, -170, 10], 0, 1), /off-page materialization/);
  assert.deepEqual(clusterLevelPage(tree, 18, [170, -10, -170, 10], 2, 1), { total: 2, features: [] });
  assert.deepEqual(clusterLevelPage(tree, 18, [80, -10, 90, 10], 0, 1), { total: 0, features: [] });
});

test('filtered overlays preserve seam bounds, nested paging, expansion, and cancellation', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => item(`i-${i}`, i / 10, i / 20));
  const tree = await buildClusterTree(rows), bytes = JSON.stringify(tree);
  const selected = new Set(rows.filter((_, i) => i % 3 === 0).map(i => i.id));
  const overlay = await filterClusterTree(tree, selected), root = clusterLevel(overlay, 2)[0]!;
  const ids: string[] = [];
  for (let offset = 0; offset < root.count; offset += 7) ids.push(...clusterLeaves(overlay, root.id, offset, 7).map(i => i.id));
  assert.deepEqual(ids.sort(), [...selected].sort());
  for (let zoom = 2; zoom <= 18; zoom++) assert.equal(clusterLevel(overlay, zoom).reduce((sum, n) => sum + n.count, 0), selected.size);
  assert.equal(JSON.stringify(tree), bytes);
  const seam = await buildClusterTree([item('a', 0, 179.9), item('b', 0, -179.9), item('c', 0, -179.8)]);
  const filtered = clusterLevel(await filterClusterTree(seam, new Set(['a', 'b'])), 2)[0]!;
  assert.equal(filtered.count, 2); assert.ok(filtered.bounds[2] - filtered.bounds[0] < 0.21);
  assert.ok(Math.abs(Math.abs(filtered.longitude) - 180) < 1e-8);
  const singleton = clusterLevel(await filterClusterTree(seam, new Set(['b'])), 2)[0]!;
  assert.equal(singleton.item!.id, 'b'); assert.equal(singleton.longitude, -179.9);
  const large = await buildClusterTree(Array.from({ length: 5000 }, (_, i) => item(String(i), 0, 0)));
  const controller = new AbortController(), pending = filterClusterTree(large, new Set(['0']), controller.signal);
  const rejected = assert.rejects(pending, /cancelled overlay/);
  setImmediate(() => controller.abort(new Error('cancelled overlay')));
  await rejected;
});
