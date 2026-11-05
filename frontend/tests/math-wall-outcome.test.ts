import assert from 'node:assert/strict';
import test from 'node:test';
import { wallOutcome } from '../src/features/math-quiz-wall/wallOutcome.ts';

test('the wall stops before the pond and never obscures the fall by moving into the water', () => {
  for (const result of ['pass', 'splash'] as const) {
    for (let step = 0; step <= 100; step++) {
      const wall = wallOutcome(result, step / 100);
      assert.ok(wall.bottom <= 72);
    }
    assert.equal(wallOutcome(result, .6).bottom, wallOutcome(result, 1).bottom);
  }
  assert.equal(wallOutcome('splash', 1).opacity, 1);
});
test('success fades the stopped wall away; failure preserves it through the splash', () => {
  assert.equal(wallOutcome('pass', 0).opacity, 1);
  assert.ok(wallOutcome('pass', .4).opacity < 1);
  assert.equal(wallOutcome('pass', 1).opacity, 0);
  assert.equal(wallOutcome('splash', .4).opacity, 1);
});
