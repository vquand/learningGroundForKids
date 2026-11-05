// Pure hierarchy checkpoint. No database, HTTP, authentication or browser work.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { buildClusterTree, clusterLeaves, clusterLevel } from '../src/explore/clusters.ts';
import { exploreFixtures } from '../../frontend/tests/browser/explore-performance-fixtures.mjs';

const args = process.argv.slice(2), output = args.includes('--out') ? args[args.indexOf('--out') + 1] : '/tmp/plg-explore-clusters';
const sourceHashes = {};
for (const path of ['../src/explore/clusters.ts', './bench-explore-clusters.mjs', '../../frontend/tests/browser/explore-performance-fixtures.mjs',
  ...['legacy', 'generated', 'expanded'].map(name => `../../frontend/data/${name}-catalog.json`)]) {
  sourceHashes[path] = createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex');
}
const results = { metadata: { protocol: 1, recordedAt: new Date().toISOString(), node: process.version,
  cpu: os.cpus()[0].model, platform: `${os.platform()} ${os.release()}`, sourceHashes, repetitions: 5,
  note: 'Pure prepared hierarchy only. Build latency excludes fixture setup, verification, serialization, database, HTTP/auth and browser. Bytes are logical serialized payload bytes, not heap/disk. Overview features are prepared nodes, not measured browser marker creations.' }, samples: [] };
for (const [fixture, input] of Object.entries(await exploreFixtures())) {
  const expected = input.map(i => i.id).sort();
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    let heartbeat = start, maxHeartbeatGapMs = 0;
    const pulse = setInterval(() => { const now = performance.now(); maxHeartbeatGapMs = Math.max(maxHeartbeatGapMs, now - heartbeat); heartbeat = now; }, 1);
    let tree;
    try { tree = await buildClusterTree(input); }
    finally { clearInterval(pulse); }
    const buildMs = performance.now() - start;
    maxHeartbeatGapMs = Math.max(maxHeartbeatGapMs, performance.now() - heartbeat);
    assert.ok(tree.nodes.length < Math.max(1, 2 * input.length));
    assert.ok(tree.nodes.every(node => node.children.every(child => child < node.id)), 'child references precede parents');
    const levels = [];
    for (let zoom = 2; zoom <= 18; zoom++) {
      const features = clusterLevel(tree, zoom), ids = [];
      for (const feature of features) for (let offset = 0; offset < feature.count; offset += 500) {
        ids.push(...clusterLeaves(tree, feature.id, offset, 500).map(i => i.id));
      }
      assert.deepEqual(ids.sort(), expected, `exact membership ${fixture} zoom ${zoom}`);
      assert.equal(features.reduce((sum, f) => sum + f.count, 0), input.length);
      levels.push({ zoom, features: features.length, clusters: features.filter(f => f.count > 1).length });
    }
    const bytes = Buffer.byteLength(JSON.stringify(tree));
    assert.ok(bytes <= 8 * 1024 * 1024, 'hierarchy fits durable snapshot payload limit');
    const sample = { fixture, run, items: input.length, nodes: tree.nodes.length, bytes, buildMs, maxHeartbeatGapMs, levels };
    results.samples.push(sample); console.log(JSON.stringify({ ...sample, levels: undefined, overviewFeatures: levels[0].features }));
  }
}
await mkdir(output, { recursive: true });
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
