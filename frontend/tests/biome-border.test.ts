import assert from 'node:assert/strict';
import test from 'node:test';
import { clippedBiomeBorder } from '../src/components/Map/biomeBorder.ts';

test('a world-spanning dashed border emits only visible segments with its original screen-space phase', () => {
  const parts = clippedBiomeBorder([[0, 5], [720, 5]], { left: 350, right: 370, top: 0, bottom: 10 }, 1024);
  assert.equal(parts.length, 2);
  const coords = (path: string) => [...path.matchAll(/[ML]([^, ]+),([^ ]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.ok(Math.abs(coords(parts[0]!.path)[0]![0]! - 350) < 1e-9);
  assert.ok(Math.abs(coords(parts[0]!.path)[1]![0]! - 370) < 1e-9);
  assert.ok(Math.abs(parts[0]!.dashOffset + (350 * 1024 / 720) % 6) < 1e-9);
  assert.ok(Math.abs(coords(parts[1]!.path)[0]![0]! - 370) < 1e-9);
  assert.ok(Math.abs(coords(parts[1]!.path)[1]![0]! - 350) < 1e-9);
});

test('offscreen and parallel borders disappear; a clipped corner remains connected', () => {
  const bounds = { left: 0, right: 10, top: 0, bottom: 10 };
  assert.deepEqual(clippedBiomeBorder([[-10, -10], [-5, -5]], bounds, 1024), []);
  assert.deepEqual(clippedBiomeBorder([[-1, 0], [-1, 10]], bounds, 1024), []);
  const parts = clippedBiomeBorder([[-10, 5], [5, 5], [5, 20]], bounds, 720);
  assert.equal(parts[0]!.path, 'M0,5 L5,5 L5,10');
  assert.equal(parts[0]!.dashOffset, -4);
});

test('fragments on both sides of the closed-path seam keep their own original phase', () => {
  const parts = clippedBiomeBorder([[5, 5], [20, 5], [20, -10], [5, -10]],
    { left: 0, top: 0, right: 10, bottom: 10 }, 720);
  assert.equal(parts.length, 2);
  assert.equal(parts[0]!.path, 'M5,5 L10,5');
  assert.ok(parts[0]!.dashOffset === 0);
  assert.equal(parts[1]!.path, 'M5,0 L5,5');
  // x projects at 1 px/unit and y at 2 px/unit: 15+30+15+20=80px.
  assert.equal(parts[1]!.dashOffset, -2);
});
