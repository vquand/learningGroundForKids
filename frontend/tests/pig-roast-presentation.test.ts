import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { roastAppearance, PIG_ROTATION_CROPS, GRILL_GLAZE_DURATION_MS } from '../src/features/cooking/pigRoastPresentation.ts';

test('roasting passes through a distinct lightly toasted stage before golden readiness', () => {
  assert.deepEqual(roastAppearance(0, 10), { warming: 0, golden: 0, label: 'Uncooked' });
  const midway = roastAppearance(6.82, 10);
  assert.equal(midway.warming, 1);
  assert.equal(midway.golden, 0);
  assert.equal(midway.label, 'Lightly toasted');
  assert.equal(roastAppearance(11, 10).golden, 1);
  assert.equal(roastAppearance(11, 10).label, 'Golden roasted');
  for (const rawLimit of [10, 11, 12, 13]) {
    let previous = { warming: 0, golden: 0 };
    for (let step = 0; step <= 200; step++) {
      const next = roastAppearance(step * (rawLimit + 1) / 200, rawLimit);
      assert.ok(next.warming >= previous.warming && next.golden >= previous.golden);
      assert.ok(next.warming - previous.warming < .03 && next.golden - previous.golden < .03);
      previous = next;
    }
  }
  assert.ok(GRILL_GLAZE_DURATION_MS >= 4000);
});
test('all six frames fit the matching transparent raw, intermediate and golden atlases', () => {
  for (const stage of ['raw', 'warming', 'good']) {
    const png = readFileSync(new URL(`../public/minigames/cooking/grill/${stage}-pork-rotation.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 1672);
    assert.equal(png.readUInt32BE(20), 941);
    assert.equal(png[25], 6, 'PNG must preserve RGBA transparency');
    for (const [x, y, w, h] of PIG_ROTATION_CROPS) {
      assert.ok(x >= 0 && y >= 0 && x + w <= 1672 && y + h <= 941);
    }
  }
});
